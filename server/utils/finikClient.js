const fs = require('fs');
const path = require('path');
const { Signer } = require('@mancho.devs/authorizer');

const ROOT = path.join(__dirname, '..', '..');
const SITE = 'https://ort.kg';
const PRIVATE_KEY_FILE = path.join(ROOT, 'finik_private.pem');
const PUBLIC_KEY_FILE = path.join(ROOT, 'finik_public.pem');

const FINIK_HOSTS = {
  prod: 'api.acquiring.averspay.kg',
  beta: 'beta.api.acquiring.averspay.kg',
};

function readPem(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').trim();
}

function trimEnv(name) {
  return String(process.env[name] || '').trim().replace(/^['"]|['"]$/g, '');
}

function getPrivateKey() {
  const pem = readPem(PRIVATE_KEY_FILE);
  if (!pem) {
    throw new Error(`Нет ${path.basename(PRIVATE_KEY_FILE)} в корне проекта`);
  }
  return pem;
}

function getMerchantPublicKey() {
  return readPem(PUBLIC_KEY_FILE);
}

function isFinikConfigured() {
  return Boolean(trimEnv('FINIK_API_KEY') && trimEnv('FINIK_ACCOUNT_ID') && readPem(PRIVATE_KEY_FILE));
}

function siteOrigin() {
  return SITE;
}

function webhookUrl() {
  return `${SITE}/api/payments/webhook`;
}

function redirectUrl() {
  return `${SITE}/pay/success`;
}

function getFinikBaseUrl(env = 'prod') {
  return `https://${FINIK_HOSTS[env] || FINIK_HOSTS.prod}`;
}

async function postPayment(env, { body, apiKey, privateKeyPem }) {
  const host = FINIK_HOSTS[env];
  const baseUrl = `https://${host}`;
  const apiPath = '/v1/payment';
  const timestamp = Date.now().toString();
  const headers = {
    Host: host,
    'x-api-key': apiKey,
    'x-api-timestamp': timestamp,
  };

  const signature = await new Signer({
    httpMethod: 'POST',
    path: apiPath,
    headers,
    queryStringParameters: undefined,
    body,
  }).sign(privateKeyPem);

  const response = await fetch(`${baseUrl}${apiPath}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'x-api-timestamp': timestamp,
      signature,
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });

  const location = response.headers.get('location');
  const text = (response.status >= 300 && response.status < 400) ? '' : await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 240) }; }
  }

  return { response, location, data, text, host, env };
}

async function createPayment({
  amount,
  paymentId,
  redirectUrl: successUrl,
  webhookUrl: hookUrl,
  accountId,
  nameEn,
  description,
  lang,
  extraData,
}) {
  if (!amount || Number(amount) <= 0) throw new Error('Amount must be greater than 0');
  if (!successUrl) throw new Error('RedirectUrl is required');
  if (!accountId) throw new Error('AccountId is required');
  if (!nameEn) throw new Error('NameEn is required');
  if (!hookUrl) throw new Error('WebhookUrl is required');
  if (!paymentId) throw new Error('PaymentId is required');

  const apiKey = trimEnv('FINIK_API_KEY');
  if (!apiKey) throw new Error('FINIK_API_KEY is not set');

  const privateKeyPem = getPrivateKey();
  const body = {
    Amount: Number(amount),
    CardType: 'FINIK_QR',
    PaymentId: paymentId,
    RedirectUrl: successUrl,
    Data: {
      accountId: String(accountId).trim(),
      merchantCategoryCode: '8299',
      name_en: nameEn,
      webhookUrl: hookUrl,
      ...(description && { description }),
      ...(lang && { Lang: lang }),
      ...(extraData || {}),
    },
  };

  const order = ['prod', 'beta'];
  let last = null;

  for (const env of order) {
    const result = await postPayment(env, { body, apiKey, privateKeyPem });
    last = result;

    if (result.response.status >= 300 && result.response.status < 400 && result.location) {
      return {
        success: true,
        paymentId,
        paymentUrl: result.location,
        status: 'CREATED',
        env,
      };
    }

    if (result.response.ok) {
      const paymentUrl = result.data.paymentUrl || result.data.url || result.data.redirectUrl || result.location;
      if (!paymentUrl) throw new Error('Finik не вернул URL оплаты');
      return { success: true, paymentId, paymentUrl, status: result.data.status || 'CREATED', env, data: result.data };
    }

    const authFail = result.response.status === 401 || result.response.status === 403;
    if (!authFail) break;
    console.warn(`Finik ${env} ${result.response.status}:`, result.data.message || result.data.ErrorMessage || result.text);
  }

  const message = last?.data?.ErrorMessage || last?.data?.errorMessage || last?.data?.message || last?.text?.slice(0, 240);
  if (last?.response?.status === 403 || last?.response?.status === 401) {
    throw new Error(
      'Finik Forbidden: API-ключ или account id не приняты, либо публичный ключ (finik_public.pem) ещё не активирован у Finik. Проверь ключи и что pem из корня проекта отправлен в Finik.',
    );
  }
  throw new Error(message || `Finik HTTP ${last?.response?.status || '?'}`);
}

module.exports = {
  SITE,
  PRIVATE_KEY_FILE,
  PUBLIC_KEY_FILE,
  createPayment,
  getPrivateKey,
  getMerchantPublicKey,
  isFinikConfigured,
  getFinikBaseUrl,
  siteOrigin,
  webhookUrl,
  redirectUrl,
  trimEnv,
};

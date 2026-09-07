const fs = require('fs');
const path = require('path');
const { Signer } = require('@mancho.devs/authorizer');

const ROOT = path.join(__dirname, '..', '..');
const SITE = 'https://ort.kg';
const PRIVATE_KEY_FILE = path.join(ROOT, 'finik_private.pem');
const PUBLIC_KEY_FILE = path.join(ROOT, 'finik_public.pem');

function readPem(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').trim();
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
  return Boolean(process.env.FINIK_API_KEY && process.env.FINIK_ACCOUNT_ID && readPem(PRIVATE_KEY_FILE));
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

function getFinikBaseUrl() {
  return 'https://api.acquiring.averspay.kg';
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
  additionalData,
}) {
  if (!amount || Number(amount) <= 0) throw new Error('Amount must be greater than 0');
  if (!successUrl) throw new Error('RedirectUrl is required');
  if (!accountId) throw new Error('AccountId is required');
  if (!nameEn) throw new Error('NameEn is required');
  if (!hookUrl) throw new Error('WebhookUrl is required');
  if (!paymentId) throw new Error('PaymentId is required');

  const apiKey = process.env.FINIK_API_KEY;
  if (!apiKey) throw new Error('FINIK_API_KEY is not set');

  const privateKeyPem = getPrivateKey();
  const baseUrl = getFinikBaseUrl();
  const host = new URL(baseUrl).host;
  const apiPath = '/v1/payment';
  const timestamp = Date.now().toString();

  const body = {
    Amount: Number(amount),
    CardType: 'FINIK_QR',
    PaymentId: paymentId,
    RedirectUrl: successUrl,
    Data: {
      accountId,
      name_en: nameEn,
      webhookUrl: hookUrl,
      ...(description && { description }),
      ...(lang && { Lang: lang }),
      ...(Array.isArray(additionalData) && additionalData.length ? { additionalData } : {}),
    },
  };

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
  if (response.status >= 300 && response.status < 400 && location) {
    return { success: true, paymentId, paymentUrl: location, status: 'CREATED' };
  }

  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* not json */ }

  if (response.ok) {
    const paymentUrl = data.paymentUrl || data.url || data.redirectUrl || location;
    if (!paymentUrl) throw new Error('Finik не вернул URL оплаты');
    return { success: true, paymentId, paymentUrl, status: data.status || 'CREATED', data };
  }

  const message = data.ErrorMessage || data.errorMessage || data.message || text.slice(0, 240);
  throw new Error(message || `Finik HTTP ${response.status}`);
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
};

const { URL } = require('url');
const { Signer } = require('@mancho.devs/authorizer');

const FINIK_PUBLIC_KEYS = {
  prod: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF/PUmhMPPidcMxhZBPb
BSGJoSphmCI+h6ru8fG8guAlcPMVlhs+ThTjw2LHABvciwtpj51ebJ4EqhlySPyT
hqSfXI6Jp5dPGJNDguxfocohaz98wvT+WAF86DEglZ8dEsfoumojFUy5sTOBdHEu
g94B4BbrJvjmBa1YIx9Azse4HFlWhzZoYPgyQpArhokeHOHIN2QFzJqeriANO+wV
aUMta2AhRVZHbfyJ36XPhGO6A5FYQWgjzkI65cxZs5LaNFmRx6pjnhjIeVKKgF99
4OoYCzhuR9QmWkPl7tL4Kd68qa/xHLz0Psnuhm0CStWOYUu3J7ZpzRK8GoEXRcr8
tQIDAQAB
-----END PUBLIC KEY-----`,
  beta: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwlrlKz/8gLWd1ARWGA/8
o3a3Qy8G+hPifyqiPosiTY6nCHovANMIJXk6DH4qAqqZeLu8pLGxudkPbv8dSyG7
F9PZEAryMPzjoB/9P/F6g0W46K/FHDtwTM3YIVvstbEbL19m8yddv/xCT9JPPJTb
LsSTVZq5zCqvKzpupwlGS3Q3oPyLAYe+ZUn4Bx2J1WQrBu3b08fNaR3E8pAkCK27
JqFnP0eFfa817VCtyVKcFHb5ij/D0eUP519Qr/pgn+gsoG63W4pPHN/pKwQUUiAy
uLSHqL5S2yu1dffyMcMVi9E/Q2HCTcez5OvOllgOtkNYHSv9pnrMRuws3u87+hNT
ZwIDAQAB
-----END PUBLIC KEY-----`,
};

function getFinikPublicKey() {
  return FINIK_PUBLIC_KEYS.prod.trim();
}

function parseWebhookBody(req) {
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (req.body && typeof req.body === 'object') return req.body;
  throw new Error('Invalid JSON body');
}

async function validateFinikSignature(req, payload) {
  const signature = req.headers.signature || req.headers['x-signature'];
  if (!signature) return false;

  const url = new URL(req.originalUrl || req.url, `http://${req.headers.host || 'localhost'}`);
  const headers = {};
  if (req.headers.host) headers.Host = req.headers.host;
  Object.keys(req.headers).forEach((key) => {
    if (key.toLowerCase().startsWith('x-api-')) headers[key] = req.headers[key];
  });

  const query = {};
  url.searchParams.forEach((value, key) => { query[key] = value; });

  try {
    return await new Signer({
      httpMethod: req.method,
      path: url.pathname,
      headers,
      queryStringParameters: Object.keys(query).length ? query : undefined,
      body: payload,
    }).verify(getFinikPublicKey(), signature);
  } catch (error) {
    console.error('Finik signature verify:', error.message);
    return false;
  }
}

function isPaidStatus(status) {
  const value = String(status || '').toLowerCase();
  return value === 'succeeded' || value === 'success' || value === 'paid';
}

function isFailedStatus(status) {
  const value = String(status || '').toLowerCase();
  return value === 'failed' || value === 'fail' || value === 'error' || value === 'canceled' || value === 'cancelled';
}

module.exports = {
  getFinikPublicKey,
  parseWebhookBody,
  validateFinikSignature,
  isPaidStatus,
  isFailedStatus,
};

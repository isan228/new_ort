const crypto = require('crypto');

const token = () => String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
// Tests point this at a local fake; production always talks to Telegram.
const apiBase = () => String(process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');

function isTelegramConfigured() {
  return !!token();
}

class TelegramError extends Error {
  constructor(method, data) {
    super(data?.description || `Telegram ${method} failed`);
    this.code = data?.error_code;
  }
}

async function tg(method, params = {}) {
  const res = await fetch(`${apiBase()}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new TelegramError(method, data);
  return data.result;
}

async function tgUpload(method, params, field, buffer, filename) {
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  form.append(field, new Blob([buffer]), filename);
  const res = await fetch(`${apiBase()}/bot${token()}/${method}`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new TelegramError(method, data);
  return data.result;
}

// Telegram sends this back in X-Telegram-Bot-Api-Secret-Token, so nobody else can post fake updates.
function webhookSecret() {
  const own = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  return own || crypto.createHash('sha256').update(`ort-telegram:${token()}`).digest('hex').slice(0, 48);
}

function publicUrl() {
  return String(process.env.PUBLIC_URL || process.env.CLIENT_URL || 'https://ort.kg').replace(/\/$/, '');
}

function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { isTelegramConfigured, tg, tgUpload, TelegramError, webhookSecret, publicUrl, escapeHtml };

const crypto = require('crypto');
const express = require('express');
const { isTelegramConfigured, tg, webhookSecret, publicUrl } = require('../utils/telegram');
const { handleUpdate, startScheduler, COMMANDS } = require('../studentbot');
const { adminIds } = require('../studentbot/ctx');

const router = express.Router();

function sameSecret(got) {
  const a = Buffer.from(String(got || ''));
  const b = Buffer.from(webhookSecret());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/webhook', async (req, res) => {
  if (!isTelegramConfigured() || !sameSecret(req.headers['x-telegram-bot-api-secret-token'])) {
    return res.status(401).json({ ok: false });
  }
  await handleUpdate(req.body || {});
  return res.json({ ok: true });
});

async function setWebhook() {
  return tg('setWebhook', {
    url: `${publicUrl()}/api/telegram/webhook`,
    secret_token: webhookSecret(),
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
}

async function poll() {
  let offset = 0;
  await tg('deleteWebhook', {});
  console.log('Telegram: опрос getUpdates (TELEGRAM_POLLING=true)');
  for (;;) {
    try {
      const updates = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (err) {
      console.warn('Telegram polling:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// Production gets a webhook on ort.kg; locally TELEGRAM_POLLING=true works without a public URL.
async function startTelegram() {
  if (!isTelegramConfigured()) return;
  console.log(`Student Bot: администраторов в SB_ADMIN_IDS — ${adminIds().length}`);
  startScheduler();
  try {
    await tg('setMyCommands', { commands: COMMANDS, scope: { type: 'all_private_chats' } });
    if (process.env.TELEGRAM_POLLING === 'true') {
      poll();
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      await setWebhook();
      console.log(`Telegram: вебхук ${publicUrl()}/api/telegram/webhook`);
    }
  } catch (err) {
    console.error('Telegram не запустился:', err.message);
  }
}

module.exports = { telegramRouter: router, startTelegram, setWebhook };

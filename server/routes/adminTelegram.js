const express = require('express');
const { Op } = require('sequelize');
const { sequelize, TelegramRequest } = require('../models');
const { getSetting } = require('../models/AppSetting');
const { isTelegramConfigured, tg, publicUrl } = require('../utils/telegram');
const { cancelRequest } = require('../utils/telegramBot');
const { setWebhook } = require('./telegram');

const router = express.Router();

async function quiet(promise) {
  try {
    return await promise;
  } catch (err) {
    return { error: err.message };
  }
}

router.get('/status', async (req, res) => {
  const configured = isTelegramConfigured();
  const groupId = process.env.TELEGRAM_GROUP_ID || await getSetting('telegram_group_id');
  const out = {
    configured,
    polling: process.env.TELEGRAM_POLLING === 'true',
    webhookUrl: `${publicUrl()}/api/telegram/webhook`,
    group: groupId ? { id: groupId, title: await getSetting('telegram_group_title') } : null,
  };
  if (configured) {
    const me = await quiet(tg('getMe'));
    out.bot = me.error ? { error: me.error } : { username: me.username, name: me.first_name };
    const hook = await quiet(tg('getWebhookInfo'));
    out.webhook = hook.error ? { error: hook.error } : {
      url: hook.url,
      pending: hook.pending_update_count,
      lastError: hook.last_error_message || null,
      lastErrorAt: hook.last_error_date ? new Date(hook.last_error_date * 1000) : null,
    };
  }
  res.json(out);
});

router.post('/webhook', async (req, res) => {
  if (!isTelegramConfigured()) return res.status(400).json({ error: 'Нет TELEGRAM_BOT_TOKEN в .env' });
  try {
    await setWebhook();
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/requests', async (req, res) => {
  const where = {};
  if (['open', 'taken', 'cancelled'].includes(req.query.status)) where.status = req.query.status;
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = { [Op.iLike]: `%${q}%` };
    where[Op.or] = [{ description: like }, { creatorName: like }, { creatorUsername: like }, { takerName: like }, { takerUsername: like }];
  }
  const rows = await TelegramRequest.findAll({ where, order: [['id', 'DESC']], limit: 300 });
  const counts = await TelegramRequest.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    group: ['status'],
    raw: true,
  });
  const people = await TelegramRequest.findAll({
    where: { status: 'taken' },
    attributes: ['takerTgId', 'takerName', 'takerUsername', [sequelize.fn('COUNT', sequelize.col('id')), 'n'], [sequelize.fn('MAX', sequelize.col('takenAt')), 'last']],
    group: ['takerTgId', 'takerName', 'takerUsername'],
    order: [[sequelize.literal('n'), 'DESC']],
    raw: true,
  });
  const merged = new Map();
  for (const p of people) {
    const row = merged.get(String(p.takerTgId)) || { tgId: String(p.takerTgId), name: p.takerName, username: p.takerUsername, taken: 0, last: null };
    row.taken += Number(p.n);
    if (!row.last || new Date(p.last) > new Date(row.last)) {
      row.last = p.last;
      row.name = p.takerName;
      row.username = p.takerUsername;
    }
    merged.set(row.tgId, row);
  }
  res.json({
    requests: rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
    people: [...merged.values()].sort((a, b) => b.taken - a.taken),
  });
});

router.post('/requests/:id/cancel', async (req, res) => {
  const row = await TelegramRequest.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Заявка не найдена' });
  if (!await cancelRequest(row, `админ ${req.user.name || req.user.login}`)) {
    return res.status(409).json({ error: 'Заявку уже приняли или отменили' });
  }
  res.json({ request: row });
});

module.exports = router;

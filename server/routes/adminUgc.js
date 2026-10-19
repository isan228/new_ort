const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User, Payment } = require('../models');
const { loginKey, assertLogin } = require('../utils/userLogin');
const { ensureReferralCode } = require('../utils/referral');

const router = express.Router();

const DAY = 24 * 60 * 60 * 1000;

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

// Per inviter: who registered with the code, who paid and how much, who started checkout but never paid.
async function referralNumbers(inviterIds) {
  const stats = new Map(inviterIds.map((id) => [id, {
    invited: 0, invited30: 0, paidUsers: 0, payments: 0, revenue: 0, pending: 0, lastInviteAt: null,
  }]));
  if (!inviterIds.length) return stats;

  const invitees = await User.findAll({
    where: { referredById: inviterIds },
    attributes: ['id', 'referredById', 'createdAt'],
  });
  const since = Date.now() - 30 * DAY;
  for (const u of invitees) {
    const row = stats.get(u.referredById);
    row.invited += 1;
    if (new Date(u.createdAt).getTime() >= since) row.invited30 += 1;
    if (!row.lastInviteAt || u.createdAt > row.lastInviteAt) row.lastInviteAt = u.createdAt;
  }

  const inviterOf = new Map(invitees.map((u) => [u.id, u.referredById]));
  if (inviterOf.size) {
    const paid = await Payment.findAll({
      where: { userId: [...inviterOf.keys()], status: 'paid' },
      attributes: ['userId', 'amount'],
    });
    const payers = new Map();
    for (const p of paid) {
      const row = stats.get(inviterOf.get(p.userId));
      row.payments += 1;
      row.revenue += p.amount;
      payers.set(p.userId, true);
    }
    for (const userId of payers.keys()) stats.get(inviterOf.get(userId)).paidUsers += 1;
  }

  // Registrations wait for payment, so an unpaid signup only exists inside the payment row.
  const pending = await Payment.findAll({
    where: {
      status: { [Op.ne]: 'paid' },
      userId: null,
      [Op.and]: [sequelize.where(sequelize.literal(`("signup"->>'referredById')::int`), { [Op.in]: inviterIds })],
    },
    attributes: ['signup'],
  });
  const seen = new Set();
  for (const p of pending) {
    const inviter = Number(p.signup?.referredById);
    const key = `${inviter}:${p.signup?.login}`;
    if (!stats.has(inviter) || seen.has(key)) continue;
    seen.add(key);
    stats.get(inviter).pending += 1;
  }
  return stats;
}

function publicUgc(user, stats) {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    phone: user.phone,
    note: user.ugcNote || '',
    active: !user.ugcDisabled,
    referralCode: user.referralCode,
    coins: user.coins || 0,
    createdAt: user.createdAt,
    stats,
  };
}

router.get('/', async (req, res) => {
  const users = await User.findAll({ where: { isUgc: true, role: 'student' }, order: [['id', 'DESC']] });
  for (const u of users) if (!u.referralCode) await ensureReferralCode(u);
  const stats = await referralNumbers(users.map((u) => u.id));
  res.json({ accounts: users.map((u) => publicUgc(u, stats.get(u.id))) });
});

router.post('/', async (req, res) => {
  const name = cleanText(req.body?.name, 120);
  const password = String(req.body?.password || '');
  if (!name) return res.status(400).json({ error: 'Укажите имя' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов' });
  let login;
  try {
    login = assertLogin(req.body?.login);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const email = `${login}@ugc.ort.local`;
  const exists = await User.findOne({ where: { [Op.or]: [{ login }, { loginKey: loginKey(login) }, { email }] } });
  if (exists) return res.status(409).json({ error: 'Такой или очень похожий логин уже занят' });
  const user = await User.create({
    name,
    login,
    email,
    phone: cleanText(req.body?.phone, 40) || null,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'student',
    isUgc: true,
    ugcNote: cleanText(req.body?.note, 300) || null,
  });
  await ensureReferralCode(user);
  const stats = await referralNumbers([user.id]);
  res.json({ account: publicUgc(user, stats.get(user.id)) });
});

router.put('/:id', async (req, res) => {
  const user = await User.findOne({ where: { id: req.params.id, role: 'student', isUgc: true } });
  if (!user) return res.status(404).json({ error: 'Аккаунт не найден' });
  const patch = {};
  if (req.body?.name !== undefined) {
    patch.name = cleanText(req.body.name, 120);
    if (!patch.name) return res.status(400).json({ error: 'Укажите имя' });
  }
  if (req.body?.note !== undefined) patch.ugcNote = cleanText(req.body.note, 300) || null;
  if (req.body?.phone !== undefined) patch.phone = cleanText(req.body.phone, 40) || null;
  if (req.body?.active !== undefined) patch.ugcDisabled = !req.body.active;
  if (req.body?.password) {
    if (String(req.body.password).length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов' });
    patch.passwordHash = await bcrypt.hash(String(req.body.password), 10);
  }
  await user.update(patch);
  const stats = await referralNumbers([user.id]);
  res.json({ account: publicUgc(user, stats.get(user.id)) });
});

router.get('/:id/invitees', async (req, res) => {
  const inviter = await User.findOne({ where: { id: req.params.id, role: 'student' } });
  if (!inviter) return res.status(404).json({ error: 'Аккаунт не найден' });
  const invitees = await User.findAll({
    where: { referredById: inviter.id },
    attributes: ['id', 'name', 'login', 'createdAt', 'subscriptionEndDate'],
    order: [['id', 'DESC']],
  });
  const paid = invitees.length
    ? await Payment.findAll({ where: { userId: invitees.map((u) => u.id), status: 'paid' }, attributes: ['userId', 'amount'] })
    : [];
  const byUser = new Map();
  for (const p of paid) {
    const row = byUser.get(p.userId) || { payments: 0, revenue: 0 };
    row.payments += 1;
    row.revenue += p.amount;
    byUser.set(p.userId, row);
  }
  res.json({
    invitees: invitees.map((u) => ({
      id: u.id,
      name: u.name,
      login: u.login,
      createdAt: u.createdAt,
      subscriptionEndDate: u.subscriptionEndDate,
      ...(byUser.get(u.id) || { payments: 0, revenue: 0 }),
    })),
  });
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, SubscriptionPlan } = require('../models');
const { requireAuth, signToken, publicUserWithPlan } = require('../middleware/auth');
const { ensureReferralCode, findInviterByCode, referralStats } = require('../utils/referral');
const { userStats, rankingFor } = require('../utils/userProgress');
const { normalizeLogin, assertLogin } = require('../utils/userLogin');

const router = express.Router();

async function findByLoginOrEmail(ident) {
  const raw = String(ident || '').trim();
  if (!raw) return null;
  const login = normalizeLogin(raw);
  const or = [{ email: raw.toLowerCase() }];
  if (login) or.unshift({ login });
  return User.findOne({ where: { [Op.or]: or } });
}

router.post('/register', async (req, res) => {
  const { name, login, email, password, phone, language, grade, planId, ref } = req.body || {};
  if (!name || !login || !password) {
    return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });
  }
  let cleanLogin;
  try {
    cleanLogin = assertLogin(login || email);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const mail = email
    ? String(email).toLowerCase().trim()
    : `${cleanLogin}@ort.local`;

  const exists = await User.findOne({
    where: { [Op.or]: [{ login: cleanLogin }, { email: mail }] },
  });
  if (exists) return res.status(409).json({ error: 'Логин уже занят' });

  const plan = await SubscriptionPlan.findByPk(Number(planId));
  if (!plan || !plan.isActive) return res.status(400).json({ error: 'Выберите тариф' });
  const subscriptionPlanId = plan.id;
  const inviter = await findInviterByCode(ref);

  const user = await User.create({
    name: String(name).trim(),
    login: cleanLogin,
    email: mail,
    passwordHash: await bcrypt.hash(password, 10),
    phone: phone || null,
    language: language === 'ky' ? 'ky' : 'ru',
    grade: grade ? Number(grade) : null,
    role: 'student',
    subscriptionPlanId,
    referredById: inviter && inviter.login !== cleanLogin ? inviter.id : null,
  });
  await ensureReferralCode(user);

  return res.json({ token: signToken(user), user: await publicUserWithPlan(user) });
});

async function checkPassword(user, password) {
  if (!user) return false;
  return bcrypt.compare(password || '', user.passwordHash);
}

router.post('/login', async (req, res) => {
  const ident = req.body.login || req.body.email;
  const user = await findByLoginOrEmail(ident);
  if (!user || !(await checkPassword(user, req.body.password))) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  if (user.role === 'admin') {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  await ensureReferralCode(user);
  return res.json({ token: signToken(user), user: await publicUserWithPlan(user) });
});

router.post('/admin-login', async (req, res) => {
  const ident = req.body.login || req.body.email;
  const user = await findByLoginOrEmail(ident);
  if (!user || !(await checkPassword(user, req.body.password))) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Нет доступа к админке', code: 'ADMIN_REQUIRED' });
  }
  return res.json({ token: signToken(user), user: await publicUserWithPlan(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  await ensureReferralCode(req.user);
  return res.json({ user: await publicUserWithPlan(req.user) });
});

router.get('/referral', requireAuth, async (req, res) => {
  const code = await ensureReferralCode(req.user);
  const stats = await referralStats(req.user.id);
  res.json({
    code,
    ...stats,
    bonusGranted: !!req.user.referralBonusGranted,
  });
});

router.get('/stats', requireAuth, async (req, res) => {
  res.json(await userStats(req.user.id));
});

router.get('/ranking', requireAuth, async (req, res) => {
  const period = ['today', 'week', 'month', 'all'].includes(req.query.period)
    ? req.query.period
    : 'week';
  res.json(await rankingFor(period, req.user.id));
});

router.patch('/me', requireAuth, async (req, res) => {
  const { name, language } = req.body || {};
  if (name) req.user.name = String(name).trim();
  if (language === 'ky' || language === 'ru') req.user.language = language;
  await req.user.save();
  return res.json({ user: await publicUserWithPlan(req.user) });
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, SubscriptionPlan } = require('../models');
const { requireAuth, signToken, publicUserWithPlan } = require('../middleware/auth');
const { ensureReferralCode, findInviterByCode, referralStats } = require('../utils/referral');
const { userStats, rankingFor } = require('../utils/userProgress');
const { REFERRAL_COINS, coinHistory } = require('../utils/coins');
const { normalizeLogin, loginKey, assertLogin } = require('../utils/userLogin');
const { applyPaidSubscription, startCheckout, sendCheckoutError } = require('../utils/paymentFlow');

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
  const { name, login, email, password, phone, language, grade, planId, ref, promoCode } = req.body || {};
  const fail = (status, code, field, error) => res.status(status).json({ error, code, field });
  if (!String(name || '').trim()) return fail(400, 'NAME_REQUIRED', 'name', 'Укажите имя');
  if (!String(login || '').trim()) return fail(400, 'LOGIN_REQUIRED', 'login', 'Придумайте логин');
  if (!password) return fail(400, 'PASSWORD_REQUIRED', 'password', 'Придумайте пароль');
  let cleanLogin;
  try {
    cleanLogin = assertLogin(login || email);
  } catch (err) {
    return fail(400, 'LOGIN_REQUIRED', 'login', err.message);
  }
  const mail = email
    ? String(email).toLowerCase().trim()
    : `${cleanLogin}@ort.local`;

  const exists = await User.findOne({
    where: { [Op.or]: [{ login: cleanLogin }, { loginKey: loginKey(cleanLogin) }, { email: mail }] },
  });
  if (exists) return fail(409, 'LOGIN_TAKEN', 'login', 'Такой или очень похожий логин уже занят');

  const plan = await SubscriptionPlan.findByPk(Number(planId));
  if (!plan || !plan.isActive) return fail(400, 'PLAN_REQUIRED', null, 'Выберите тариф');
  const inviter = await findInviterByCode(ref);
  const lang = language === 'ky' ? 'ky' : 'ru';

  const signup = {
    name: String(name).trim(),
    login: cleanLogin,
    email: email ? mail : null,
    passwordHash: await bcrypt.hash(password, 10),
    phone: phone || null,
    language: lang,
    grade: grade ? Number(grade) : null,
    referredById: inviter && inviter.login !== cleanLogin ? inviter.id : null,
  };

  let checkout;
  try {
    checkout = await startCheckout({ plan, signup, lang, promoCode: promoCode || null });
  } catch (err) {
    return sendCheckoutError(res, err);
  }

  if (checkout.demo || checkout.free) {
    const user = await applyPaidSubscription(checkout.payment);
    return res.json({ token: signToken(user), user: await publicUserWithPlan(user) });
  }

  return res.json({
    paymentUrl: checkout.paymentUrl,
    paymentId: checkout.paymentId,
    claim: checkout.payment.claimToken,
  });
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
  if (user.role === 'admin' || user.role === 'editor') {
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
  if (user.role !== 'admin' && user.role !== 'editor') {
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
  const [stats, history] = await Promise.all([
    referralStats(req.user.id),
    coinHistory(req.user.id),
  ]);
  res.json({
    code,
    ...stats,
    bonusGranted: !!req.user.referralBonusGranted,
    coins: req.user.coins || 0,
    coinsPerFriend: REFERRAL_COINS,
    coinHistory: history,
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

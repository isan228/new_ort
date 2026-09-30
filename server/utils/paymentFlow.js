const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Payment, User, PromoCode } = require('../models');
const { PromoError, applyPromo } = require('./promoCodes');
const { COIN_VALUE_SOM, addCoins, reservedCoins, grantReferralCoins } = require('./coins');
const { loginKey } = require('./userLogin');
const { ensureReferralCode, maybeGrantReferralBonus } = require('./referral');
const { createPayment, isFinikConfigured, webhookUrl, redirectUrl, trimEnv } = require('./finikClient');

class CheckoutError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function allowDemoPayments() {
  if (isFinikConfigured()) return false;
  if (process.env.FINIK_ALLOW_DEMO === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

async function loginBusy(candidate, transaction) {
  return User.findOne({
    where: { [Op.or]: [{ login: candidate }, { loginKey: loginKey(candidate) }] },
    transaction,
  });
}

async function freeLogin(login, transaction) {
  let candidate = login;
  for (let i = 2; await loginBusy(candidate, transaction); i += 1) {
    candidate = `${login}${i}`;
  }
  return candidate;
}

async function createUserFromSignup(payment, transaction) {
  const data = payment.signup || {};
  const login = await freeLogin(data.login, transaction);
  if (login !== data.login) {
    console.warn(`Оплата ${payment.id}: логин ${data.login} заняли, выдан ${login}`);
  }
  let email = data.email || `${login}@ort.local`;
  if (await User.findOne({ where: { email }, transaction })) email = `${login}.${payment.id}@ort.local`;
  return User.create({
    name: data.name,
    login,
    email,
    passwordHash: data.passwordHash,
    phone: data.phone || null,
    language: data.language === 'ky' ? 'ky' : 'ru',
    grade: data.grade || null,
    role: 'student',
    subscriptionPlanId: payment.planId,
    referredById: data.referredById || null,
  }, { transaction });
}

async function applyPaidSubscription(paymentOrId) {
  const id = typeof paymentOrId === 'object' ? paymentOrId.id : paymentOrId;
  const user = await sequelize.transaction(async (transaction) => {
    const payment = await Payment.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (payment.status === 'paid') return User.findByPk(payment.userId, { transaction });

    let target = payment.userId
      ? await User.findByPk(payment.userId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    if (!target && payment.signup) {
      target = await createUserFromSignup(payment, transaction);
      await grantReferralCoins(target, transaction);
    }
    if (!target) throw new Error(`Оплата ${payment.id}: нет пользователя и данных регистрации`);

    const base = target.subscriptionEndDate && new Date(target.subscriptionEndDate) > new Date()
      ? new Date(target.subscriptionEndDate)
      : new Date();
    base.setMonth(base.getMonth() + payment.months);
    target.subscriptionEndDate = base;
    if (payment.planId) target.subscriptionPlanId = payment.planId;
    await target.save({ transaction });

    const signup = payment.signup ? { ...payment.signup, passwordHash: undefined, login: target.login } : null;
    await payment.update({ status: 'paid', userId: target.id, signup }, { transaction });
    if (payment.promoCodeId) {
      await PromoCode.increment('usedCount', { by: 1, where: { id: payment.promoCodeId }, transaction });
    }
    if (payment.coinsUsed > 0) {
      const spend = Math.min(payment.coinsUsed, target.coins || 0);
      if (spend < payment.coinsUsed) {
        console.warn(`Оплата ${payment.id}: списано ${spend} монет вместо ${payment.coinsUsed}`);
      }
      await addCoins(target, -spend, 'payment', { paymentId: payment.id, transaction });
    }
    return target;
  });
  await ensureReferralCode(user);
  await maybeGrantReferralBonus(user);
  return user;
}

async function coinsForCheckout(userId, due, transaction) {
  const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  const available = Math.max(0, (user?.coins || 0) - await reservedCoins(userId, transaction));
  return Math.min(available, Math.ceil(due / COIN_VALUE_SOM));
}

async function startCheckout({
  plan,
  userId = null,
  signup = null,
  lang = 'ru',
  promoCode = null,
  useCoins = false,
}) {
  const paymentId = crypto.randomUUID();
  const payment = await sequelize.transaction(async (transaction) => {
    const applied = promoCode ? await applyPromo({ code: promoCode, plan, userId, transaction }) : null;
    const discount = applied ? applied.discount : 0;
    const coinsUsed = useCoins && userId ? await coinsForCheckout(userId, plan.price - discount, transaction) : 0;
    return Payment.create({
      userId,
      planId: plan.id,
      type: 'ort_subscription',
      status: 'pending',
      amount: Math.max(0, plan.price - discount - coinsUsed * COIN_VALUE_SOM),
      coinsUsed,
      months: plan.months,
      providerRef: paymentId,
      signup,
      claimToken: signup ? crypto.randomBytes(32).toString('hex') : null,
      promoCodeId: applied ? applied.promo.id : null,
      discount,
    }, { transaction });
  });

  if (payment.amount <= 0) return { payment, paymentId, free: true };

  if (!isFinikConfigured()) {
    if (!allowDemoPayments()) {
      await payment.update({ status: 'failed' });
      console.error('Finik не настроен: нужны FINIK_API_KEY, FINIK_ACCOUNT_ID и finik_private.pem');
      throw new CheckoutError(503, 'PAYMENT_UNAVAILABLE', 'Оплата временно недоступна');
    }
    return { payment, paymentId, demo: true };
  }

  const originRedirect = new URL(redirectUrl());
  originRedirect.search = '';

  let result;
  try {
    result = await createPayment({
      amount: payment.amount,
      paymentId,
      redirectUrl: originRedirect.toString(),
      webhookUrl: webhookUrl(),
      accountId: trimEnv('FINIK_ACCOUNT_ID'),
      nameEn: 'ORT KG',
      description: `ОРТ подписка ${plan.months} мес. · ${plan.title}`,
      lang: lang === 'ky' ? 'ky' : 'ru',
      extraData: {
        localPaymentId: String(payment.id),
        ...(userId && { userId: String(userId) }),
        planId: String(plan.id),
        paymentType: 'ort_subscription',
      },
    });
  } catch (error) {
    console.error('Finik create payment:', error);
    await payment.update({ status: 'failed' });
    throw new CheckoutError(502, 'PAYMENT_FAILED', 'Не удалось открыть страницу оплаты');
  }

  if (!result.paymentUrl) {
    await payment.update({ status: 'failed' });
    console.error('Finik не вернул paymentUrl', result);
    throw new CheckoutError(502, 'PAYMENT_FAILED', 'Не удалось открыть страницу оплаты');
  }

  return { payment, paymentId, paymentUrl: result.paymentUrl };
}

function sendCheckoutError(res, err) {
  if (err instanceof CheckoutError || err instanceof PromoError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  throw err;
}

module.exports = {
  CheckoutError,
  allowDemoPayments,
  applyPaidSubscription,
  startCheckout,
  sendCheckoutError,
};

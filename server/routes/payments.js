const crypto = require('crypto');
const express = require('express');
const { Op } = require('sequelize');
const { SubscriptionPlan, Payment, User } = require('../models');
const { requireAuth, publicUser } = require('../middleware/auth');
const { createPayment, isFinikConfigured, webhookUrl, redirectUrl, trimEnv } = require('../utils/finikClient');
const {
  parseWebhookBody,
  validateFinikSignature,
  isPaidStatus,
  isFailedStatus,
} = require('../utils/finikValidator');

const router = express.Router();

function allowDemoPayments() {
  if (isFinikConfigured()) return false;
  if (process.env.FINIK_ALLOW_DEMO === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

async function applyPaidSubscription(payment) {
  if (payment.status === 'paid') {
    return User.findByPk(payment.userId);
  }
  const user = await User.findByPk(payment.userId);
  if (!user) throw new Error('Пользователь платежа не найден');
  const base = user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()
    ? new Date(user.subscriptionEndDate)
    : new Date();
  base.setMonth(base.getMonth() + payment.months);
  user.subscriptionEndDate = base;
  await user.save();
  payment.status = 'paid';
  await payment.save();
  return user;
}

async function findPaymentByFinik(payload) {
  const fields = payload.fields || {};
  const refs = [
    payload.transactionId,
    payload.paymentId,
    payload.PaymentId,
    fields.paymentId,
    payload.id,
  ].filter(Boolean).map(String);

  if (refs.length) {
    const found = await Payment.findOne({
      where: { providerRef: { [Op.in]: refs } },
      order: [['id', 'DESC']],
    });
    if (found) return found;
  }

  const localId = Number(fields.localPaymentId);
  if (localId) return Payment.findByPk(localId);
  return null;
}

router.get('/plans', async (req, res) => {
  const plans = await SubscriptionPlan.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['months', 'ASC']],
  });
  res.json({ plans, finik: isFinikConfigured() });
});

router.post('/create', requireAuth, async (req, res) => {
  const plan = await SubscriptionPlan.findByPk(req.body.planId);
  if (!plan || !plan.isActive) return res.status(404).json({ error: 'Тариф не найден' });

  const paymentId = crypto.randomUUID();
  const payment = await Payment.create({
    userId: req.user.id,
    planId: plan.id,
    type: 'ort_subscription',
    status: 'pending',
    amount: plan.price,
    months: plan.months,
    providerRef: paymentId,
  });

  if (!isFinikConfigured()) {
    if (!allowDemoPayments()) {
      await payment.update({ status: 'failed' });
      return res.status(503).json({ error: 'Finik не настроен. В .env нужны FINIK_API_KEY и FINIK_ACCOUNT_ID, в корне проекта — finik_private.pem' });
    }
    return res.json({ payment, demo: true });
  }

  const originRedirect = new URL(redirectUrl());
  originRedirect.search = '';

  try {
    const result = await createPayment({
      amount: plan.price,
      paymentId,
      redirectUrl: originRedirect.toString(),
      webhookUrl: webhookUrl(),
      accountId: trimEnv('FINIK_ACCOUNT_ID'),
      nameEn: 'ORT KG',
      description: `ОРТ подписка ${plan.months} мес. · ${plan.title}`,
      lang: req.user.language === 'ky' ? 'ky' : 'ru',
      extraData: {
        localPaymentId: String(payment.id),
        userId: String(req.user.id),
        planId: String(plan.id),
        paymentType: 'ort_subscription',
      },
    });

    if (!result.paymentUrl) {
      await payment.update({ status: 'failed' });
      return res.status(502).json({ error: 'Finik не вернул страницу оплаты' });
    }

    res.json({
      payment,
      paymentId,
      paymentUrl: result.paymentUrl,
    });
  } catch (error) {
    console.error('Finik create payment:', error);
    await payment.update({ status: 'failed' });
    res.status(502).json({ error: error.message || 'Не удалось создать платёж Finik' });
  }
});

router.post('/confirm-demo', requireAuth, async (req, res) => {
  if (!allowDemoPayments()) {
    return res.status(403).json({ error: 'Демо-оплата выключена. Используйте Finik.' });
  }
  const payment = await Payment.findOne({
    where: { id: req.body.paymentId, userId: req.user.id },
  });
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
  const user = await applyPaidSubscription(payment);
  res.json({ payment, user: publicUser(user) });
});

router.get('/status', async (req, res) => {
  const paymentId = String(req.query.paymentId || '').trim();
  if (!paymentId) return res.status(400).json({ error: 'paymentId обязателен' });

  let payment = await Payment.findOne({ where: { providerRef: paymentId } });
  if (!payment && /^\d+$/.test(paymentId)) {
    payment = await Payment.findByPk(Number(paymentId));
  }
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  res.json({
    status: payment.status,
    paid: payment.status === 'paid',
    months: payment.months,
    amount: payment.amount,
  });
});

router.post('/webhook', async (req, res) => {
  let payload;
  try {
    payload = parseWebhookBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const signatureValid = await validateFinikSignature(req, payload);
  if (!signatureValid) {
    console.error('Finik webhook: invalid signature');
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Finik webhook: invalid signature (dev)');
    } else {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const payment = await findPaymentByFinik(payload);
  if (!payment) {
    console.error('Finik webhook: payment not found', {
      transactionId: payload.transactionId,
      id: payload.id,
      fields: payload.fields,
    });
    return res.status(404).json({ error: 'Платёж не найден' });
  }

  if (isPaidStatus(payload.status)) {
    await applyPaidSubscription(payment);
  } else if (isFailedStatus(payload.status) && payment.status !== 'paid') {
    payment.status = 'failed';
    await payment.save();
  }

  res.json({ ok: true });
});

module.exports = router;

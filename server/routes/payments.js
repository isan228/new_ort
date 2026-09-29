const crypto = require('crypto');
const express = require('express');
const { Op } = require('sequelize');
const { SubscriptionPlan, Payment, User } = require('../models');
const { requireAuth, publicUserWithPlan, signToken } = require('../middleware/auth');
const { ensurePlansForOrt } = require('../utils/subscriptionPlans');
const { isFinikConfigured } = require('../utils/finikClient');
const {
  allowDemoPayments,
  applyPaidSubscription,
  startCheckout,
  sendCheckoutError,
} = require('../utils/paymentFlow');
const {
  parseWebhookBody,
  validateFinikSignature,
  isPaidStatus,
  isFailedStatus,
} = require('../utils/finikValidator');

const router = express.Router();

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

function claimMatches(payment, claim) {
  if (!payment.claimToken || !claim) return false;
  const a = Buffer.from(String(payment.claimToken));
  const b = Buffer.from(String(claim));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.get('/plans', async (req, res) => {
  await ensurePlansForOrt();
  const plans = await SubscriptionPlan.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['months', 'ASC']],
  });
  res.json({ plans, finik: isFinikConfigured() });
});

router.post('/create', requireAuth, async (req, res) => {
  const plan = await SubscriptionPlan.findByPk(req.body.planId);
  if (!plan || !plan.isActive) {
    return res.status(404).json({ error: 'Тариф не найден', code: 'PLAN_NOT_FOUND' });
  }
  try {
    const { payment, paymentId, paymentUrl, demo } = await startCheckout({
      plan,
      userId: req.user.id,
      lang: req.user.language,
    });
    return res.json({ payment, paymentId, paymentUrl, demo: !!demo });
  } catch (err) {
    return sendCheckoutError(res, err);
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
  res.json({ payment, user: await publicUserWithPlan(user) });
});

router.get('/status', async (req, res) => {
  const paymentId = String(req.query.paymentId || '').trim();
  if (!paymentId) return res.status(400).json({ error: 'paymentId обязателен' });

  let payment = await Payment.findOne({ where: { providerRef: paymentId } });
  if (!payment && /^\d+$/.test(paymentId)) {
    payment = await Payment.findByPk(Number(paymentId));
  }
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  const body = {
    status: payment.status,
    paid: payment.status === 'paid',
    months: payment.months,
    amount: payment.amount,
  };

  if (body.paid && payment.userId && claimMatches(payment, req.query.claim)) {
    const user = await User.findByPk(payment.userId);
    if (user) {
      body.token = signToken(user);
      body.user = await publicUserWithPlan(user);
    }
  }

  res.json(body);
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

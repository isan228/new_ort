const express = require('express');
const { SubscriptionPlan, Payment, User } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { publicUser } = require('../middleware/auth');

const router = express.Router();

router.get('/plans', async (req, res) => {
  const plans = await SubscriptionPlan.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['months', 'ASC']],
  });
  res.json({ plans });
});

router.post('/create', requireAuth, async (req, res) => {
  const plan = await SubscriptionPlan.findByPk(req.body.planId);
  if (!plan || !plan.isActive) return res.status(404).json({ error: 'Тариф не найден' });

  const payment = await Payment.create({
    userId: req.user.id,
    planId: plan.id,
    type: 'ort_subscription',
    status: 'pending',
    amount: plan.price,
    months: plan.months,
  });

  res.json({ payment });
});

async function applyPaidSubscription(payment) {
  const user = await User.findByPk(payment.userId);
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

router.post('/confirm-demo', requireAuth, async (req, res) => {
  const payment = await Payment.findOne({
    where: { id: req.body.paymentId, userId: req.user.id },
  });
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
  const user = await applyPaidSubscription(payment);
  res.json({ payment, user: publicUser(user) });
});

router.post('/webhook', async (req, res) => {
  const { paymentId, status } = req.body || {};
  const payment = await Payment.findByPk(paymentId);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
  if (status === 'paid' && payment.status !== 'paid') {
    await applyPaidSubscription(payment);
  }
  res.json({ ok: true });
});

module.exports = router;

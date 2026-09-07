const { SubscriptionPlan } = require('../models');

const DEFAULT_PLANS = [
  { title: '1 месяц', months: 1, price: 500, oldPrice: 700, sortOrder: 1 },
  { title: '3 месяца', months: 3, price: 1200, oldPrice: 1500, sortOrder: 2 },
  { title: '12 месяцев', months: 12, price: 3000, oldPrice: 4000, sortOrder: 3 },
];

async function ensurePlansForOrt() {
  const count = await SubscriptionPlan.count();
  if (count > 0) return;
  await SubscriptionPlan.bulkCreate(DEFAULT_PLANS);
}

module.exports = { ensurePlansForOrt, DEFAULT_PLANS };

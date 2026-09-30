const { Op } = require('sequelize');
const { PromoCode, Payment } = require('../models');

// Pending payments hold a promo use this long, so a limited code cannot be oversold while users are on the payment page.
const RESERVE_MINUTES = 30;

class PromoError extends Error {
  constructor(code, message) {
    super(message);
    this.status = 400;
    this.code = code;
  }
}

function normalizeCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function discountFor(promo, price) {
  const raw = promo.discountType === 'fixed'
    ? promo.discountValue
    : Math.round((price * promo.discountValue) / 100);
  return Math.max(0, Math.min(price, raw));
}

function planAllowed(promo, planId) {
  const ids = Array.isArray(promo.planIds) ? promo.planIds.map(Number) : [];
  return !ids.length || ids.includes(Number(planId));
}

async function reservedCount(promo, transaction) {
  const since = new Date(Date.now() - RESERVE_MINUTES * 60 * 1000);
  return Payment.count({
    where: { promoCodeId: promo.id, status: 'pending', createdAt: { [Op.gt]: since } },
    transaction,
  });
}

async function findUsablePromo(code, { transaction, lock = false } = {}) {
  const clean = normalizeCode(code);
  if (!clean) throw new PromoError('PROMO_NOT_FOUND', 'Промокод не найден');
  const promo = await PromoCode.findOne({
    where: { code: clean },
    transaction,
    ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!promo || !promo.isActive) throw new PromoError('PROMO_NOT_FOUND', 'Промокод не найден');
  const now = new Date();
  if (promo.startsAt && new Date(promo.startsAt) > now) {
    throw new PromoError('PROMO_NOT_STARTED', 'Промокод ещё не начал действовать');
  }
  if (promo.endsAt && new Date(promo.endsAt) < now) {
    throw new PromoError('PROMO_EXPIRED', 'Срок действия промокода истёк');
  }
  if (promo.maxUses != null) {
    const taken = promo.usedCount + await reservedCount(promo, transaction);
    if (taken >= promo.maxUses) throw new PromoError('PROMO_LIMIT', 'Промокод уже закончился');
  }
  return promo;
}

async function applyPromo({ code, plan, userId = null, transaction }) {
  const promo = await findUsablePromo(code, { transaction, lock: true });
  if (!planAllowed(promo, plan.id)) {
    throw new PromoError('PROMO_PLAN', 'Промокод не действует на этот тариф');
  }
  if (userId) {
    const used = await Payment.count({
      where: { userId, promoCodeId: promo.id, status: 'paid' },
      transaction,
    });
    if (used) throw new PromoError('PROMO_USED', 'Вы уже использовали этот промокод');
  }
  return { promo, discount: discountFor(promo, plan.price) };
}

function publicPromo(promo) {
  return {
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    planIds: Array.isArray(promo.planIds) && promo.planIds.length ? promo.planIds.map(Number) : null,
    endsAt: promo.endsAt,
  };
}

module.exports = {
  PromoError,
  normalizeCode,
  discountFor,
  planAllowed,
  reservedCount,
  findUsablePromo,
  applyPromo,
  publicPromo,
};

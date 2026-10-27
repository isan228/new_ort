const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { SbUser, SbAccessLog, SbPayment, SbReferral } = require('./models');
const { loadConfig } = require('./config');
const { DAY, HOUR } = require('./time');

const REF_BONUS_DAYS = 3;
const REF_LIMIT_DAYS = 30;

function promoEnd(cfg) {
  if (!cfg.launchAt) return 0;
  return new Date(cfg.launchAt).getTime() + (cfg.promoHours || 72) * HOUR;
}

function promoActive(cfg, now = Date.now()) {
  const end = promoEnd(cfg);
  return !!cfg.launchAt && now >= new Date(cfg.launchAt).getTime() && now < end;
}

const ms = (d) => (d ? new Date(d).getTime() : 0);

// Spending order: launch promo → paid/bonus days → the advance day. Free mode overrides everything.
function accessStatus(user, cfg, now = Date.now()) {
  if (cfg.freeMode) return { active: true, kind: 'free', until: null };
  if (promoActive(cfg, now)) return { active: true, kind: 'promo', until: new Date(Math.max(promoEnd(cfg), ms(user.accessEnd))) };
  if (ms(user.accessEnd) > now) return { active: true, kind: 'paid', until: user.accessEnd };
  if (ms(user.advanceUntil) > now) return { active: true, kind: 'advance', until: user.advanceUntil };
  return { active: false, kind: 'expired', until: user.accessEnd || null, advanceReady: user.advanceAvailable };
}

async function log(user, kind, days, endBefore, endAfter, note, transaction) {
  await SbAccessLog.create({ userId: user.id, kind, days, endBefore, endAfter, note }, { transaction });
}

// The advance day starts the first time the user tries a new deal after access ran out,
// so the one-day deduction only applies when the advance was really used.
async function ensureAccess(user, now = Date.now()) {
  const cfg = await loadConfig();
  const status = accessStatus(user, cfg, now);
  if (status.active || !user.advanceAvailable) return status;
  await sequelize.transaction(async (transaction) => {
    const fresh = await SbUser.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!fresh.advanceAvailable || accessStatus(fresh, cfg, now).active) return;
    const until = new Date(now + DAY);
    await fresh.update({ advanceAvailable: false, advanceUntil: until, advanceDebt: fresh.advanceDebt + 1 }, { transaction });
    await log(fresh, 'advance', 1, fresh.accessEnd, until, 'Авансовые сутки после окончания срока', transaction);
    Object.assign(user, { advanceAvailable: false, advanceUntil: until, advanceDebt: fresh.advanceDebt });
  });
  return accessStatus(user, cfg, now);
}

function extendFrom(user, cfg, now) {
  return Math.max(now, promoEnd(cfg), ms(user.accessEnd));
}

async function bonusDaysLast30(userId, transaction, now = Date.now()) {
  const sum = await SbAccessLog.sum('days', {
    where: { userId, kind: 'referral', createdAt: { [Op.gt]: new Date(now - 30 * DAY) } },
    transaction,
  });
  return Number(sum || 0);
}

async function grantReferralBonus(userId, referralId, transaction) {
  const cfg = await loadConfig();
  const user = await SbUser.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  if (await bonusDaysLast30(userId, transaction) + REF_BONUS_DAYS > REF_LIMIT_DAYS) return 'limit';
  const before = user.accessEnd;
  const end = new Date(extendFrom(user, cfg, Date.now()) + REF_BONUS_DAYS * DAY);
  await user.update({ accessEnd: end }, { transaction });
  await log(user, 'referral', REF_BONUS_DAYS, before, end, `Реферал №${referralId}`, transaction);
  return 'granted';
}

// Both sides of an invitation get +3 days once both have paid at least once.
async function settleReferrals(userId, transaction) {
  const links = await SbReferral.findAll({
    where: { state: 'registered', [Op.or]: [{ referrerId: userId }, { inviteeId: userId }] },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const granted = [];
  for (const link of links) {
    const [referrer, invitee] = await Promise.all([
      SbUser.findByPk(link.referrerId, { transaction }),
      SbUser.findByPk(link.inviteeId, { transaction }),
    ]);
    if (!referrer?.paidCount || !invitee?.paidCount) continue;
    const referrerBonus = await grantReferralBonus(referrer.id, link.id, transaction);
    const inviteeBonus = await grantReferralBonus(invitee.id, link.id, transaction);
    await link.update({ state: 'granted', referrerBonus, inviteeBonus, grantedAt: new Date() }, { transaction });
    granted.push({ link, referrer, invitee, referrerBonus, inviteeBonus });
  }
  return granted;
}

// A paid 7/30-day period. The used advance day is taken out of it, and a fresh advance is earned.
async function applyPurchase(userId, days, {
  provider = 'manual', externalId = null, note = null, transaction: outer = null,
} = {}) {
  const cfg = await loadConfig();
  const run = async (transaction) => {
    const user = await SbUser.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const now = Date.now();
    const debt = Math.min(user.advanceDebt, days);
    const net = days - debt;
    const before = user.accessEnd;
    const end = new Date(extendFrom(user, cfg, now) + net * DAY);
    await user.update({
      accessEnd: end,
      advanceDebt: user.advanceDebt - debt,
      advanceAvailable: true,
      advanceUntil: null,
      paidCount: user.paidCount + 1,
    }, { transaction });
    const payment = await SbPayment.create({ userId, days, provider, externalId, note }, { transaction });
    await log(user, 'purchase', net, before, end,
      debt ? `Оплачено ${days} дн., вычтено ${debt} дн. за использованный аванс` : `Оплачено ${days} дн.`, transaction);
    const referrals = await settleReferrals(userId, transaction);
    return { user, payment, net, debt, referrals };
  };
  return outer ? run(outer) : sequelize.transaction(run);
}

async function adminAdjust(userId, days, note) {
  const cfg = await loadConfig();
  return sequelize.transaction(async (transaction) => {
    const user = await SbUser.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const before = user.accessEnd;
    const base = days > 0 ? extendFrom(user, cfg, Date.now()) : ms(user.accessEnd) || Date.now();
    const end = new Date(base + days * DAY);
    await user.update({ accessEnd: end }, { transaction });
    await log(user, 'admin', days, before, end, note, transaction);
    return user;
  });
}

// Refund: take the period back and flag referral bonuses it unlocked for the admin to review.
async function refundPayment(paymentId, note) {
  return sequelize.transaction(async (transaction) => {
    const payment = await SbPayment.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!payment || payment.status !== 'paid') return null;
    const user = await SbUser.findByPk(payment.userId, { transaction, lock: transaction.LOCK.UPDATE });
    const before = user.accessEnd;
    const end = new Date(Math.max(Date.now(), ms(user.accessEnd)) - payment.days * DAY);
    await user.update({ accessEnd: end, paidCount: Math.max(0, user.paidCount - 1) }, { transaction });
    await payment.update({ status: 'refunded', note }, { transaction });
    await log(user, 'refund', -payment.days, before, end, note, transaction);
    await SbReferral.update({ state: 'review' }, {
      where: { state: 'granted', [Op.or]: [{ referrerId: user.id }, { inviteeId: user.id }] },
      transaction,
    });
    return { payment, user };
  });
}

async function referralStats(userId) {
  const links = await SbReferral.findAll({ where: { referrerId: userId }, order: [['id', 'DESC']] });
  const invitees = links.length ? await SbUser.findAll({ where: { id: links.map((l) => l.inviteeId) } }) : [];
  const byId = new Map(invitees.map((u) => [u.id, u]));
  const used = await bonusDaysLast30(userId);
  return {
    invited: links.length,
    waiting: links.filter((l) => l.state === 'registered').length,
    granted: links.filter((l) => l.referrerBonus === 'granted').length,
    limited: links.filter((l) => l.referrerBonus === 'limit').length,
    bonusDays30: used,
    left30: Math.max(0, REF_LIMIT_DAYS - used),
    rows: links.map((l) => ({ link: l, invitee: byId.get(l.inviteeId) })),
  };
}

module.exports = {
  REF_BONUS_DAYS,
  REF_LIMIT_DAYS,
  promoEnd,
  promoActive,
  accessStatus,
  ensureAccess,
  applyPurchase,
  adminAdjust,
  refundPayment,
  referralStats,
};

const { Op } = require('sequelize');
const { User, Payment, CoinTransaction } = require('../models');

const REFERRAL_COINS = 50;
// One coin pays one som of a subscription.
const COIN_VALUE_SOM = 1;
const RESERVE_MINUTES = 30;

async function addCoins(user, amount, reason, { paymentId = null, relatedUserId = null, transaction } = {}) {
  if (!amount) return;
  await User.increment('coins', { by: amount, where: { id: user.id }, transaction });
  user.coins = (user.coins || 0) + amount;
  await CoinTransaction.create({ userId: user.id, amount, reason, paymentId, relatedUserId }, { transaction });
}

async function reservedCoins(userId, transaction) {
  const since = new Date(Date.now() - RESERVE_MINUTES * 60 * 1000);
  const sum = await Payment.sum('coinsUsed', {
    where: { userId, status: 'pending', coinsUsed: { [Op.gt]: 0 }, createdAt: { [Op.gt]: since } },
    transaction,
  });
  return Number(sum || 0);
}

async function grantReferralCoins(invitee, transaction) {
  if (!invitee.referredById || invitee.referralCoinsGranted) return;
  const inviter = await User.findByPk(invitee.referredById, { transaction, lock: transaction.LOCK.UPDATE });
  invitee.referralCoinsGranted = true;
  await invitee.save({ transaction });
  await addCoins(invitee, REFERRAL_COINS, 'referral_invitee', { relatedUserId: inviter?.id || null, transaction });
  if (inviter) {
    await addCoins(inviter, REFERRAL_COINS, 'referral_inviter', { relatedUserId: invitee.id, transaction });
  }
}

async function coinHistory(userId, limit = 30) {
  const rows = await CoinTransaction.findAll({
    where: { userId },
    include: [{ model: User, as: 'Related', attributes: ['name'] }],
    order: [['id', 'DESC']],
    limit,
  });
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    reason: row.reason,
    friend: row.Related?.name || null,
    createdAt: row.createdAt,
  }));
}

module.exports = {
  REFERRAL_COINS,
  COIN_VALUE_SOM,
  addCoins,
  reservedCoins,
  grantReferralCoins,
  coinHistory,
};

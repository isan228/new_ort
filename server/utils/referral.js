const { Op } = require('sequelize');
const { User, Payment } = require('../models');

const REFERRAL_GOAL = 5;
const REFERRAL_BONUS_DAYS = 7;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode() {
  let out = 'ORT-';
  for (let i = 0; i < 6; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    const taken = await User.findOne({ where: { referralCode: code } });
    if (taken) continue;
    user.referralCode = code;
    await user.save();
    return code;
  }
  user.referralCode = `ORT-${user.id}${Date.now().toString(36).slice(-4).toUpperCase()}`;
  await user.save();
  return user.referralCode;
}

async function ensureReferralCodes() {
  const rows = await User.findAll({ where: { referralCode: { [Op.or]: [null, ''] } } });
  for (const user of rows) {
    await ensureReferralCode(user);
  }
}

async function findInviterByCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!code) return null;
  return User.findOne({ where: { referralCode: code } });
}

async function referralStats(userId) {
  const invitedUsers = await User.findAll({
    where: { referredById: userId },
    attributes: ['id', 'subscriptionEndDate'],
  });
  const ids = invitedUsers.map((row) => row.id);
  let premium = 0;
  if (ids.length) {
    const paid = await Payment.findAll({
      where: { userId: ids, status: 'paid' },
      attributes: ['userId'],
    });
    premium = new Set(paid.map((row) => row.userId)).size;
  }
  const invited = invitedUsers.length;
  return {
    invited,
    registered: invited,
    premiumFromRef: premium,
    goal: REFERRAL_GOAL,
    bonusDays: REFERRAL_BONUS_DAYS,
    bonusReady: premium >= REFERRAL_GOAL,
  };
}

async function maybeGrantReferralBonus(referredUser) {
  if (!referredUser?.referredById) return;
  const inviter = await User.findByPk(referredUser.referredById);
  if (!inviter || inviter.referralBonusGranted) return;
  const stats = await referralStats(inviter.id);
  if (!stats.bonusReady) return;
  const base = inviter.subscriptionEndDate && new Date(inviter.subscriptionEndDate) > new Date()
    ? new Date(inviter.subscriptionEndDate)
    : new Date();
  base.setDate(base.getDate() + REFERRAL_BONUS_DAYS);
  inviter.subscriptionEndDate = base;
  inviter.referralBonusGranted = true;
  await inviter.save();
}

module.exports = {
  REFERRAL_GOAL,
  REFERRAL_BONUS_DAYS,
  ensureReferralCode,
  ensureReferralCodes,
  findInviterByCode,
  referralStats,
  maybeGrantReferralBonus,
};

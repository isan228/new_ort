const jwt = require('jsonwebtoken');
const { User } = require('../models');

const DEV_SECRET = 'dev-secret';
// Values from .env.example and DEPLOY.md are public, so a token signed with them can be forged.
const PLACEHOLDER_SECRETS = new Set([DEV_SECRET, 'change-this-to-a-long-random-string', 'длинная_случайная_строка']);

function jwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (process.env.NODE_ENV === 'production' && (!secret || PLACEHOLDER_SECRETS.has(secret))) {
    throw new Error('JWT_SECRET в .env не задан или взят из примера. Сгенерируйте: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  }
  return secret || DEV_SECRET;
}

function assertJwtSecret() {
  const secret = jwtSecret();
  if (secret.length < 32) console.warn('JWT_SECRET короче 32 символов — лучше заменить на длинную случайную строку');
}

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Нужна авторизация', code: 'AUTH_REQUIRED' });
    }
    const payload = jwt.verify(token, jwtSecret());
    const user = await User.findByPk(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден', code: 'AUTH_REQUIRED' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Сессия истекла', code: 'AUTH_REQUIRED' });
  }
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Только для администратора', code: 'ADMIN_REQUIRED' });
    }
    return next();
  });
}

async function requireStaff(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.user || !['admin', 'editor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Только для администратора или редактора', code: 'ADMIN_REQUIRED' });
    }
    return next();
  });
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    jwtSecret(),
    { expiresIn: '30d' },
  );
}

function publicUser(user, plan) {
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const resolved = plan || user.SubscriptionPlan || null;
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    email: user.email,
    phone: user.phone,
    role: user.role,
    language: user.language,
    grade: user.grade,
    subscriptionEndDate: end,
    subscriptionActive: user.role === 'admin' || (!!user.isUgc && !user.ugcDisabled) || !!(end && end > new Date()),
    unlimited: !!user.isUgc && !user.ugcDisabled,
    subscriptionPlanId: user.subscriptionPlanId || resolved?.id || null,
    subscriptionTitle: resolved?.title || null,
    subscriptionMonths: resolved?.months || null,
    referralCode: user.referralCode || null,
    coins: user.coins || 0,
    // Registered through a referral link: promo codes are not offered to them.
    invited: !!user.referredById,
    ...(user.role === 'editor' ? { editorSubjectIds: user.editorSubjectIds || [] } : {}),
  };
}

async function publicUserWithPlan(user) {
  if (!user) return null;
  if (user.SubscriptionPlan) return publicUser(user, user.SubscriptionPlan);
  if (!user.subscriptionPlanId) return publicUser(user);
  const { SubscriptionPlan } = require('../models/SubscriptionPlan');
  const plan = await SubscriptionPlan.findByPk(user.subscriptionPlanId);
  return publicUser(user, plan);
}

module.exports = {
  assertJwtSecret,
  requireAuth,
  requireAdmin,
  requireStaff,
  signToken,
  publicUser,
  publicUserWithPlan,
};

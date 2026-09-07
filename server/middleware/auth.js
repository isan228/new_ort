const jwt = require('jsonwebtoken');
const { User } = require('../models');

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
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
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

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '30d' },
  );
}

function publicUser(user) {
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    language: user.language,
    grade: user.grade,
    subscriptionEndDate: end,
    subscriptionActive: user.role === 'admin' || (end && end > new Date()),
  };
}

module.exports = { requireAuth, requireAdmin, signToken, publicUser };

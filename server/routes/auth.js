const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { requireAuth, signToken, publicUser } = require('../middleware/auth');
const { normalizeLogin, assertLogin } = require('../utils/userLogin');

const router = express.Router();

async function findByLoginOrEmail(ident) {
  const raw = String(ident || '').trim();
  if (!raw) return null;
  const login = normalizeLogin(raw);
  const or = [{ email: raw.toLowerCase() }];
  if (login) or.unshift({ login });
  return User.findOne({ where: { [Op.or]: or } });
}

router.post('/register', async (req, res) => {
  const { name, login, email, password, phone, language, grade } = req.body || {};
  if (!name || !login || !password) {
    return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });
  }
  let cleanLogin;
  try {
    cleanLogin = assertLogin(login || email);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const mail = email
    ? String(email).toLowerCase().trim()
    : `${cleanLogin}@ort.local`;

  const exists = await User.findOne({
    where: { [Op.or]: [{ login: cleanLogin }, { email: mail }] },
  });
  if (exists) return res.status(409).json({ error: 'Логин уже занят' });

  const user = await User.create({
    name: String(name).trim(),
    login: cleanLogin,
    email: mail,
    passwordHash: await bcrypt.hash(password, 10),
    phone: phone || null,
    language: language === 'ky' ? 'ky' : 'ru',
    grade: grade ? Number(grade) : null,
    role: 'student',
  });

  return res.json({ token: signToken(user), user: publicUser(user) });
});

async function checkPassword(user, password) {
  if (!user) return false;
  return bcrypt.compare(password || '', user.passwordHash);
}

router.post('/login', async (req, res) => {
  const ident = req.body.login || req.body.email;
  const user = await findByLoginOrEmail(ident);
  if (!user || !(await checkPassword(user, req.body.password))) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  if (user.role === 'admin') {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  return res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/admin-login', async (req, res) => {
  const ident = req.body.login || req.body.email;
  const user = await findByLoginOrEmail(ident);
  if (!user || !(await checkPassword(user, req.body.password))) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Нет доступа к админке', code: 'ADMIN_REQUIRED' });
  }
  return res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

module.exports = router;

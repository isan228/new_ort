const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { requireAuth, signToken, publicUser } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, phone, language, grade } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
  }
  const exists = await User.findOne({ where: { email: String(email).toLowerCase() } });
  if (exists) return res.status(409).json({ error: 'Email уже занят' });

  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash: await bcrypt.hash(password, 10),
    phone: phone || null,
    language: language === 'ky' ? 'ky' : 'ru',
    grade: grade ? Number(grade) : null,
  });

  return res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ where: { email: String(email || '').toLowerCase() } });
  if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });
  return res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

module.exports = router;

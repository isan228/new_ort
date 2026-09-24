const express = require('express');
const { ChatMessage } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function publicMessage(row) {
  return {
    id: row.id,
    userId: row.userId,
    fromAdmin: row.fromAdmin,
    text: row.text,
    createdAt: row.createdAt,
    readAt: row.readAt,
  };
}

router.get('/messages', async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Админ открывает чат в панели' });
  }
  await ChatMessage.update(
    { readAt: new Date() },
    { where: { userId: req.user.id, fromAdmin: true, readAt: null } },
  );
  const rows = await ChatMessage.findAll({
    where: { userId: req.user.id },
    order: [['id', 'ASC']],
    limit: 300,
  });
  res.json({ messages: rows.map(publicMessage) });
});

router.post('/messages', async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Отвечайте из админки' });
  }
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Напишите сообщение' });
  if (text.length > 2000) return res.status(400).json({ error: 'Слишком длинное сообщение' });
  const row = await ChatMessage.create({
    userId: req.user.id,
    authorId: req.user.id,
    fromAdmin: false,
    text,
  });
  res.json({ message: publicMessage(row) });
});

router.get('/unread', async (req, res) => {
  if (req.user.role === 'admin') {
    const unread = await ChatMessage.count({ where: { fromAdmin: false, readAt: null } });
    return res.json({ unread });
  }
  const unread = await ChatMessage.count({
    where: { userId: req.user.id, fromAdmin: true, readAt: null },
  });
  res.json({ unread });
});

module.exports = { chatRouter: router, publicMessage };

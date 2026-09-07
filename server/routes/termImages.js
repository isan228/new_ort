const express = require('express');
const { Op } = require('sequelize');
const { TermImage } = require('../models');

const router = express.Router();

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const where = { isActive: true };
  if (q) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${q}%` } },
      { description: { [Op.iLike]: `%${q}%` } },
    ];
  }
  const items = await TermImage.findAll({ where, order: [['title', 'ASC']] });
  res.json({ items });
});

router.get('/keywords', async (req, res) => {
  const items = await TermImage.findAll({ where: { isActive: true } });
  const keywords = [];
  for (const item of items) {
    for (const word of item.keywords || []) {
      keywords.push({
        word,
        termId: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
        description: item.description,
      });
    }
  }
  res.json({ keywords });
});

module.exports = router;

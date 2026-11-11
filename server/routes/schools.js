const express = require('express');
const { School, sequelize } = require('../models');

const router = express.Router();

// Schools without a region or district (unsplit addresses) are listed under this key.
const NONE = '-';

const keyOf = (value) => value || NONE;
const valueOf = (key) => (key === NONE ? null : String(key));

// Public directory for the registration form: only schools the admin left visible.
router.get('/regions', async (req, res) => {
  const rows = await School.findAll({
    attributes: ['region', 'district', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    where: { isActive: true },
    group: ['region', 'district'],
    raw: true,
  });
  const regions = new Map();
  for (const row of rows) {
    const key = keyOf(row.region);
    const region = regions.get(key) || { key, name: row.region, districts: [] };
    region.districts.push({ key: keyOf(row.district), name: row.district, count: Number(row.n) });
    regions.set(key, region);
  }
  const byName = (a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || String(a.name).localeCompare(String(b.name), 'ru');
  res.json({
    regions: [...regions.values()].sort(byName).map((r) => ({ ...r, districts: r.districts.sort(byName) })),
  });
});

router.get('/', async (req, res) => {
  if (!req.query.region || !req.query.district) return res.status(400).json({ error: 'Выберите область и район' });
  const schools = await School.findAll({
    where: { isActive: true, region: valueOf(req.query.region), district: valueOf(req.query.district) },
    attributes: ['id', 'name', 'address'],
    order: [['name', 'ASC']],
  });
  res.json({ schools });
});

module.exports = router;

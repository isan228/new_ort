const express = require('express');
const { Op } = require('sequelize');
const { School, sequelize } = require('../models');
const { importSchools, splitAddress } = require('../utils/schoolsImport');
const { getSetting, setSetting } = require('../models/AppSetting');

const router = express.Router();
const LAST_IMPORT = 'schools.lastImport';

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 50));
  const where = {};
  if (req.query.region) where.region = req.query.region === '-' ? null : String(req.query.region);
  if (req.query.district) where.district = String(req.query.district);
  if (req.query.status === 'hidden') where.isActive = false;
  else if (req.query.status !== 'all') where.isActive = true;
  const q = clean(req.query.q, 120);
  if (q) where[Op.or] = [{ name: { [Op.iLike]: `%${q}%` } }, { address: { [Op.iLike]: `%${q}%` } }];
  const { count, rows } = await School.findAndCountAll({
    where, order: [['region', 'ASC'], ['district', 'ASC'], ['name', 'ASC']], limit, offset: (page - 1) * limit,
  });
  res.json({ schools: rows, total: count, page, limit });
});

// Regions and districts with school counts for the filters.
router.get('/facets', async (req, res) => {
  const rows = await School.findAll({
    attributes: ['region', 'district', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    where: { isActive: true },
    group: ['region', 'district'],
    raw: true,
  });
  const regions = new Map();
  for (const row of rows) {
    const key = row.region || '';
    const region = regions.get(key) || { region: row.region, count: 0, districts: [] };
    region.count += Number(row.n);
    if (row.district) region.districts.push({ district: row.district, count: Number(row.n) });
    regions.set(key, region);
  }
  const list = [...regions.values()]
    .map((r) => ({ ...r, districts: r.districts.sort((a, b) => a.district.localeCompare(b.district, 'ru')) }))
    .sort((a, b) => (a.region ? 0 : 1) - (b.region ? 0 : 1) || String(a.region).localeCompare(String(b.region), 'ru'));
  const [total, hidden, last] = await Promise.all([
    School.count(), School.count({ where: { isActive: false } }), getSetting(LAST_IMPORT),
  ]);
  res.json({ regions: list, total, hidden, lastImport: last ? JSON.parse(last) : null });
});

let importing = null;
router.post('/import', async (req, res) => {
  if (importing) return res.status(409).json({ error: 'Загрузка уже идёт — подождите минуту' });
  importing = importSchools();
  try {
    const stats = await importing;
    await setSetting(LAST_IMPORT, JSON.stringify({ at: new Date().toISOString(), ...stats }));
    res.json(stats);
  } catch (err) {
    console.error('schools import:', err.message);
    res.status(502).json({ error: err.message });
  } finally {
    importing = null;
  }
});

function schoolPayload(body) {
  const name = clean(body.name, 300);
  const address = clean(body.address, 500) || null;
  const parsed = splitAddress(address);
  return {
    name,
    address,
    region: clean(body.region, 120) || parsed.region,
    district: clean(body.district, 160) || parsed.district,
  };
}

router.post('/', async (req, res) => {
  const data = schoolPayload(req.body || {});
  if (!data.name) return res.status(400).json({ error: 'Укажите название школы' });
  const school = await School.create({ ...data, source: 'manual' });
  res.json({ school });
});

router.put('/:id', async (req, res) => {
  const school = await School.findByPk(req.params.id);
  if (!school) return res.status(404).json({ error: 'Школа не найдена' });
  const patch = {};
  if (req.body.isActive !== undefined) patch.isActive = !!req.body.isActive;
  if (req.body.name !== undefined || req.body.address !== undefined || req.body.region !== undefined || req.body.district !== undefined) {
    const data = schoolPayload({ ...school.toJSON(), ...req.body });
    if (!data.name) return res.status(400).json({ error: 'Укажите название школы' });
    Object.assign(patch, data, { editedByAdmin: true });
  }
  await school.update(patch);
  res.json({ school });
});

router.delete('/:id', async (req, res) => {
  await School.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;

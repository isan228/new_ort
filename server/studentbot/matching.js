const { Op } = require('sequelize');
const { SbUser, SbOrder, SbSlot } = require('./models');
const { loadConfig } = require('./config');
const { accessStatus } = require('./access');
const { ratingsFor, ratingValue } = require('./ui');

const t = (d) => new Date(d).getTime();

function normalizePlace(text) {
  return String(text || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/[«»"'.,]/g, '').replace(/\s+/g, ' ');
}

// Free-text place → directory entry by name or synonym; unknown places keep their own key.
function resolvePlace(text, cfg) {
  const norm = normalizePlace(text);
  for (const p of cfg.places) {
    const names = [p.name, ...(p.synonyms || [])].map(normalizePlace);
    if (names.includes(norm)) return { key: p.key, text: p.name, known: true };
  }
  return { key: `x:${norm}`, text: String(text).trim(), known: false };
}

function restricted(user, now = Date.now()) {
  return user.needsReview || (user.blockedUntil && t(user.blockedUntil) > now);
}

function canDeal(user, cfg, now = Date.now()) {
  return user.registered && !!user.username && !restricted(user, now) && accessStatus(user, cfg, now).active;
}

function facultyFits(mode, wanted, other) {
  if (mode === 'any' || !mode) return true;
  return (wanted || '') === (other.faculty || '');
}

// Both sides' wishes must hold; the free slot has to cover the whole requested time.
function compatible(order, customer, slot, executor) {
  if (order.status !== 'OPEN' || slot.state !== 'OPEN') return false;
  if (customer.id === executor.id) return false;
  if (order.date !== slot.date) return false;
  if (t(slot.startsAt) > t(order.startsAt) || t(slot.endsAt) < t(order.endsAt)) return false;
  if (!(slot.places || []).some((p) => p.key === order.placeKey)) return false;
  if (order.requiredSex !== 'any' && order.requiredSex !== executor.sex) return false;
  if (slot.customerSex !== 'any' && slot.customerSex !== customer.sex) return false;
  if (!facultyFits(order.facultyMode, order.faculty, executor)) return false;
  if (!facultyFits(slot.facultyMode, executor.faculty, customer)) return false;
  return true;
}

async function busyUserIds(userIds, startsAt, endsAt, exceptOrderId = null, transaction) {
  if (!userIds.length) return new Set();
  const rows = await SbOrder.findAll({
    where: {
      status: 'ACCEPTED',
      ...(exceptOrderId ? { id: { [Op.ne]: exceptOrderId } } : {}),
      startsAt: { [Op.lt]: endsAt },
      endsAt: { [Op.gt]: startsAt },
      [Op.or]: [{ creatorId: userIds }, { executorId: userIds }],
    },
    attributes: ['creatorId', 'executorId'],
    transaction,
  });
  const busy = new Set();
  for (const o of rows) {
    if (userIds.includes(o.creatorId)) busy.add(o.creatorId);
    if (userIds.includes(o.executorId)) busy.add(o.executorId);
  }
  return busy;
}

async function executorsForOrder(order, customer) {
  const cfg = await loadConfig();
  const slots = await SbSlot.findAll({
    where: { state: 'OPEN', date: order.date, endsAt: { [Op.gt]: new Date() }, userId: { [Op.ne]: customer.id } },
  });
  const users = slots.length ? await SbUser.findAll({ where: { id: [...new Set(slots.map((s) => s.userId))] } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const fits = slots
    .map((slot) => ({ slot, user: byId.get(slot.userId) }))
    .filter(({ slot, user }) => user && canDeal(user, cfg) && compatible(order, customer, slot, user));
  const busy = await busyUserIds([...new Set(fits.map((f) => f.user.id))], order.startsAt, order.endsAt);
  const seen = new Set();
  const free = fits.filter((f) => !busy.has(f.user.id) && !seen.has(f.user.id) && seen.add(f.user.id));
  const ratings = await ratingsFor(free.map((f) => f.user.id));
  return free.sort((a, b) => (
    Number(b.user.faculty === customer.faculty) - Number(a.user.faculty === customer.faculty)
    || ratingValue(ratings.get(b.user.id).executor) - ratingValue(ratings.get(a.user.id).executor)
    || t(b.slot.createdAt) - t(a.slot.createdAt)
  ));
}

async function ordersForExecutor(executor, onlySlots = null) {
  const cfg = await loadConfig();
  const slots = onlySlots || await SbSlot.findAll({ where: { userId: executor.id, state: 'OPEN', endsAt: { [Op.gt]: new Date() } } });
  if (!slots.length) return [];
  const orders = await SbOrder.findAll({
    where: {
      status: 'OPEN',
      date: [...new Set(slots.map((s) => s.date))],
      endsAt: { [Op.gt]: new Date() },
      creatorId: { [Op.ne]: executor.id },
    },
  });
  const customers = orders.length ? await SbUser.findAll({ where: { id: [...new Set(orders.map((o) => o.creatorId))] } }) : [];
  const byId = new Map(customers.map((u) => [u.id, u]));
  const out = [];
  for (const order of orders) {
    const customer = byId.get(order.creatorId);
    if (!customer || restricted(customer)) continue;
    const slot = slots.find((s) => compatible(order, customer, s, executor));
    if (slot) out.push({ order, customer, slot });
  }
  const busyExec = await Promise.all(out.map((row) => busyUserIds([executor.id, row.customer.id], row.order.startsAt, row.order.endsAt)));
  return out
    .filter((_, i) => !busyExec[i].size)
    .sort((a, b) => t(a.order.startsAt) - t(b.order.startsAt) || t(b.order.createdAt) - t(a.order.createdAt));
}

module.exports = {
  normalizePlace,
  resolvePlace,
  restricted,
  canDeal,
  compatible,
  busyUserIds,
  executorsForOrder,
  ordersForExecutor,
};

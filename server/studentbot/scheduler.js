const { Op } = require('sequelize');
const {
  SbUser, SbOrder, SbSlot, SbInvitation, SbCompletion, SbReview, SbReport, SbMessage,
} = require('./models');
const { expireInvitations, notifyInvalidated, other } = require('./deals');
const { notifyAdmins } = require('./ctx');
const { MIN, HOUR, humanDateTime } = require('./time');
const {
  esc, btn, kb, send, orderWhen, orderKb,
} = require('./ui');

const START_REMINDER = 60 * MIN;
const COMPLETION_REMINDER = 24 * HOUR;
const CHAT_RETENTION = 48 * HOUR;

// Every step only touches rows whose status still matches, so overlapping ticks are harmless.
async function expireOrders(now) {
  const due = await SbOrder.findAll({ where: { status: 'OPEN', startsAt: { [Op.lte]: now } } });
  for (const o of due) {
    const [changed] = await SbOrder.update(
      { status: 'CANCELLED', cancelReason: 'EXPIRED', cancelledAt: now },
      { where: { id: o.id, status: 'OPEN' } },
    );
    if (!changed) continue;
    const pending = await SbInvitation.findAll({ where: { orderId: o.id, state: 'PENDING' } });
    await SbInvitation.update({ state: 'INVALIDATED' }, { where: { orderId: o.id, state: 'PENDING' } });
    await notifyInvalidated({ pending, note: 'время заявки наступило', exceptUserId: o.creatorId });
    const u = await SbUser.findByPk(o.creatorId);
    await send(u.tgId, `⌛ Заявка №${o.id} (${esc(orderWhen(o))}) истекла без исполнителя.`, kb([btn('Создать похожую', `ocopy:${o.id}`)]));
  }
}

async function expireSlots(now) {
  await SbSlot.update({ state: 'EXPIRED' }, { where: { state: 'OPEN', endsAt: { [Op.lte]: now } } });
}

async function remindStart(now) {
  const due = await SbOrder.findAll({
    where: { status: 'ACCEPTED', reminded: false, startsAt: { [Op.lte]: new Date(now.getTime() + START_REMINDER), [Op.gt]: now } },
  });
  for (const o of due) {
    const [changed] = await SbOrder.update({ reminded: true }, { where: { id: o.id, reminded: false } });
    if (!changed) continue;
    for (const uid of [o.creatorId, o.executorId]) {
      const u = await SbUser.findByPk(uid);
      await send(u.tgId, `⏰ Скоро начало заказа №${o.id}: ${esc(orderWhen(o))}, ${esc(o.placeText)}.`, orderKb(o));
    }
  }
}

async function askCompletion(now) {
  const due = await SbOrder.findAll({ where: { status: 'ACCEPTED', completionAsked: false, endsAt: { [Op.lte]: now } } });
  for (const o of due) {
    const [changed] = await SbOrder.update({ completionAsked: true }, { where: { id: o.id, completionAsked: false } });
    if (!changed) continue;
    const done = new Set((await SbCompletion.findAll({ where: { orderId: o.id } })).map((c) => c.userId));
    for (const uid of [o.creatorId, o.executorId]) {
      if (done.has(uid)) continue;
      const u = await SbUser.findByPk(uid);
      await send(u.tgId, `Задача по заказу №${o.id} выполнена? Подтверждение нужно от обоих участников.`, kb(
        [btn('✅ Выполнено', `ok:${o.id}`), btn('Ещё не выполнено', `o:${o.id}`)],
        [btn('Сообщить о проблеме', `op:${o.id}`)],
      ));
    }
  }
}

// One side confirmed, the other is silent for 24 h: remind once, then hand the case to admins.
async function remindCompletion(now) {
  const first = await SbCompletion.findAll({ where: { createdAt: { [Op.lte]: new Date(now.getTime() - COMPLETION_REMINDER) } } });
  const ids = [...new Set(first.map((c) => c.orderId))];
  if (!ids.length) return;
  const orders = await SbOrder.findAll({ where: { id: ids, status: 'ACCEPTED', completionReminded: false } });
  for (const o of orders) {
    const [changed] = await SbOrder.update({ completionReminded: true }, { where: { id: o.id, completionReminded: false } });
    if (!changed) continue;
    const confirmed = first.find((c) => c.orderId === o.id).userId;
    const u = await SbUser.findByPk(other(o, confirmed));
    await send(u.tgId, `Напоминание: участник уже отметил заказ №${o.id} выполненным. Подтвердите или сообщите о проблеме.`, kb(
      [btn('✅ Выполнено', `ok:${o.id}`), btn('Сообщить о проблеме', `op:${o.id}`)],
    ));
    await notifyAdmins(`Заказ №${o.id}: одна сторона подтвердила выполнение ${humanDateTime(first.find((c) => c.orderId === o.id).createdAt)}, вторая молчит 24 ч. Можно закрыть вручную.`, kb([btn('Открыть заказ', `ad:o:${o.id}`)]));
  }
}

async function revealReviews(now) {
  await SbReview.update({ revealed: true }, { where: { revealed: false, revealAfter: { [Op.lte]: now } } });
}

// Chat text and files are dropped 48 h after the order closes, unless a report keeps them as evidence.
async function purgeChats(now) {
  const edge = new Date(now.getTime() - CHAT_RETENTION);
  const orders = await SbOrder.findAll({
    where: {
      chatPurged: false,
      [Op.or]: [
        { status: 'COMPLETED', completedAt: { [Op.lte]: edge } },
        { status: 'CANCELLED', cancelledAt: { [Op.lte]: edge } },
      ],
    },
    attributes: ['id'],
    limit: 200,
  });
  if (!orders.length) return;
  const held = new Set((await SbReport.findAll({
    where: { orderId: orders.map((o) => o.id), status: ['OPEN', 'WAITING'] },
    attributes: ['orderId'],
  })).map((r) => r.orderId));
  for (const o of orders) {
    if (held.has(o.id)) continue;
    await SbMessage.update({ text: null, fileId: null, purged: true }, { where: { orderId: o.id, purged: false } });
    await SbOrder.update({ chatPurged: true }, { where: { id: o.id } });
  }
}

async function tick() {
  const now = new Date();
  await expireInvitations();
  await expireOrders(now);
  await expireSlots(now);
  await remindStart(now);
  await askCompletion(now);
  await remindCompletion(now);
  await revealReviews(now);
  await purgeChats(now);
}

let timer = null;
let running = false;

function startScheduler(intervalMs = Number(process.env.SB_TICK_MS) || 30000) {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      console.error('studentbot scheduler:', err.message);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref?.();
}

function stopScheduler() {
  clearInterval(timer);
  timer = null;
}

module.exports = { tick, startScheduler, stopScheduler };

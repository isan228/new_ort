const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  SbUser, SbOrder, SbSlot, SbInvitation, SbCompletion, SbReview, SbModeration,
} = require('./models');
const { ensureAccess } = require('./access');
const { compatible, busyUserIds, restricted } = require('./matching');
const { MIN, HOUR, DAY, humanDateTime } = require('./time');
const {
  esc, btn, kb, send, orderBody, orderWhen, orderKb,
} = require('./ui');

const INVITE_LIMIT = 3;
const t = (d) => new Date(d).getTime();

class DealError extends Error {}

function ttlFor(order, now = Date.now()) {
  const urgent = t(order.startsAt) - now <= HOUR;
  return { urgent, expiresAt: new Date(Math.min(now + (urgent ? 5 : 15) * MIN, t(order.startsAt))) };
}

function other(order, userId) {
  return order.creatorId === userId ? order.executorId : order.creatorId;
}

function roleIn(order, userId) {
  return order.creatorId === userId ? 'customer' : 'executor';
}

async function invitationText(inv, order, from) {
  const minutes = Math.max(1, Math.round((t(inv.expiresAt) - Date.now()) / MIN));
  const who = inv.initiatorRole === 'customer' ? 'Вас приглашают выполнить заказ' : 'На вашу заявку откликнулся исполнитель';
  return [
    `🔔 <b>${who} №${order.id}</b>`,
    `От: <b>${esc(from.nickname)}</b>`,
    '',
    orderBody(order),
    '',
    `⏳ Ответьте за ${minutes} мин. Первый подтверждённый ответ получает заказ.`,
  ].join('\n');
}

async function invite({ order, slot, initiator }) {
  if (order.status !== 'OPEN') throw new DealError('Заявка уже не активна');
  if (slot.state !== 'OPEN') throw new DealError('Свободный слот уже занят или удалён');
  const role = initiator.id === order.creatorId ? 'customer' : 'executor';
  if (role === 'executor' && slot.userId !== initiator.id) throw new DealError('Это не ваш слот');
  const targetId = role === 'customer' ? slot.userId : order.creatorId;
  const [customer, executor] = await Promise.all([SbUser.findByPk(order.creatorId), SbUser.findByPk(slot.userId)]);
  if (!compatible(order, customer, slot, executor)) throw new DealError('Заявка и свободный слот больше не совпадают');
  const existing = await SbInvitation.findOne({ where: { orderId: order.id, slotId: slot.id, state: 'PENDING' } });
  if (existing) throw new DealError(existing.initiatorId === initiator.id ? 'Приглашение уже отправлено' : 'Вам уже пришло приглашение по этой заявке — ответьте на него в чате');
  const scope = role === 'customer' ? { orderId: order.id } : { slotId: slot.id };
  const pending = await SbInvitation.count({ where: { initiatorId: initiator.id, state: 'PENDING', ...scope } });
  if (pending >= INVITE_LIMIT) throw new DealError(`Уже ${INVITE_LIMIT} ожидающих приглашения. Отмените одно в «Мои → Приглашения», чтобы отправить новое.`);
  const { urgent, expiresAt } = ttlFor(order);
  if (t(expiresAt) <= Date.now()) throw new DealError('Задание уже начинается — приглашение отправить нельзя');
  const inv = await SbInvitation.create({
    orderId: order.id,
    slotId: slot.id,
    initiatorId: initiator.id,
    targetId,
    initiatorRole: role,
    urgent,
    expiresAt,
    orderRevision: order.revision,
  });
  const target = role === 'customer' ? executor : customer;
  await send(target.tgId, await invitationText(inv, order, initiator), kb(
    [btn('✅ Принять', `ia:${inv.id}`), btn('Отказаться', `id:${inv.id}`)],
    [btn('Профиль участника', `ip:${inv.id}`)],
  ));
  return inv;
}

// Accepts on different orders can still lock each other's pending invitations; Postgres aborts one, we retry it.
async function retryOnDeadlock(fn, attempts = 3) {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (err.parent?.code !== '40P01' || i >= attempts) throw err;
    }
  }
}

// Accept = agreement to the sender's terms. Everything is rechecked under row locks,
// so two simultaneous accepts or a stale invitation can never produce a second deal.
async function acceptInvitation(invId, user) {
  const probe = await SbInvitation.findByPk(invId, { attributes: ['orderId'] });
  if (!probe) throw new DealError('Приглашение не найдено');
  // The order row is always locked first, so competing accepts queue up instead of deadlocking.
  const result = await retryOnDeadlock(() => sequelize.transaction(async (transaction) => {
    await SbOrder.findByPk(probe.orderId, { transaction, lock: transaction.LOCK.UPDATE });
    const inv = await SbInvitation.findByPk(invId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!inv || inv.targetId !== user.id) throw new DealError('Приглашение не найдено');
    if (inv.state === 'ACCEPTED') throw new DealError('Вы уже приняли это приглашение');
    if (inv.state === 'INVALIDATED') throw new DealError('Заказ уже занят или условия изменились');
    if (inv.state !== 'PENDING') throw new DealError('Приглашение больше не действует');
    if (t(inv.expiresAt) < Date.now()) {
      await inv.update({ state: 'EXPIRED' }, { transaction });
      throw new DealError('Время ответа истекло');
    }
    const order = await SbOrder.findByPk(inv.orderId, { transaction, lock: transaction.LOCK.UPDATE });
    const slot = await SbSlot.findByPk(inv.slotId, { transaction, lock: transaction.LOCK.UPDATE });
    if (order.status !== 'OPEN' || order.revision !== inv.orderRevision || slot.state !== 'OPEN') {
      await inv.update({ state: 'INVALIDATED' }, { transaction });
      throw new DealError('Условия изменились или заказ уже занят');
    }
    const [customer, executor] = await Promise.all([
      SbUser.findByPk(order.creatorId, { transaction }),
      SbUser.findByPk(slot.userId, { transaction }),
    ]);
    for (const u of [customer, executor]) {
      if (restricted(u)) throw new DealError(`${u.id === user.id ? 'Ваш аккаунт' : 'Аккаунт участника'} временно ограничен`);
    }
    const status = await ensureAccess(user);
    if (!status.active) throw new DealError('NO_ACCESS');
    if (!compatible(order, customer, slot, executor)) {
      await inv.update({ state: 'INVALIDATED' }, { transaction });
      throw new DealError('Заявка и слот больше не совпадают');
    }
    const busy = await busyUserIds([customer.id, executor.id], order.startsAt, order.endsAt, null, transaction);
    if (busy.size) throw new DealError(busy.has(user.id) ? 'У вас уже есть подтверждённый заказ на это время' : 'У участника уже есть заказ на это время');

    await order.update({ status: 'ACCEPTED', executorId: executor.id, slotId: slot.id, acceptedAt: new Date() }, { transaction });
    await slot.update({ state: 'BOOKED' }, { transaction });
    await inv.update({ state: 'ACCEPTED', respondedAt: new Date() }, { transaction });

    // Close competing offers: this order, this slot, and anything overlapping for either person.
    const pending = await SbInvitation.findAll({
      where: {
        state: 'PENDING',
        [Op.or]: [
          { orderId: order.id }, { slotId: slot.id },
          { initiatorId: [customer.id, executor.id] }, { targetId: [customer.id, executor.id] },
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const pendingOrders = pending.length
      ? await SbOrder.findAll({ where: { id: [...new Set(pending.map((p) => p.orderId))] }, transaction })
      : [];
    const orderById = new Map(pendingOrders.map((o) => [o.id, o]));
    const closed = [];
    for (const p of pending) {
      const o = orderById.get(p.orderId);
      const overlaps = o && t(o.startsAt) < t(order.endsAt) && t(order.startsAt) < t(o.endsAt);
      if (p.orderId === order.id || p.slotId === slot.id || overlaps) {
        await p.update({ state: 'INVALIDATED' }, { transaction });
        closed.push(p);
      }
    }
    return { order, customer, executor, closed };
  }));

  const { order, customer, executor, closed } = result;
  const text = (who) => [
    `🤝 <b>Заказ №${order.id} подтверждён</b>`,
    `Участник: <b>${esc(who.nickname)}</b>`,
    '',
    orderBody(order),
    '',
    'Свяжитесь через «Переписку» в боте. Контакты открываются только по вашему действию.',
  ].join('\n');
  await send(customer.tgId, text(executor), orderKb(order));
  await send(executor.tgId, text(customer), orderKb(order));
  const notified = new Set([customer.id, executor.id]);
  for (const p of closed) {
    for (const uid of [p.initiatorId, p.targetId]) {
      if (notified.has(uid)) continue;
      const u = await SbUser.findByPk(uid);
      await send(u.tgId, `Приглашение по заказу №${p.orderId} больше не актуально: исполнитель уже найден или занят. Штрафов нет.`);
    }
  }
  return order;
}

async function respondInvitation(invId, user, state) {
  const inv = await SbInvitation.findByPk(invId);
  if (!inv || inv.state !== 'PENDING') throw new DealError('Приглашение уже не действует');
  const allowed = state === 'DECLINED' ? inv.targetId === user.id : inv.initiatorId === user.id;
  if (!allowed) throw new DealError('Приглашение не найдено');
  const [changed] = await SbInvitation.update({ state, respondedAt: new Date() }, { where: { id: inv.id, state: 'PENDING' } });
  if (!changed) throw new DealError('Приглашение уже не действует');
  const notifyId = state === 'DECLINED' ? inv.initiatorId : inv.targetId;
  const u = await SbUser.findByPk(notifyId);
  await send(u.tgId, state === 'DECLINED'
    ? `Приглашение по заказу №${inv.orderId} отклонено. Можно выбрать другого участника.`
    : `Приглашение по заказу №${inv.orderId} отозвано.`);
  return inv;
}

async function expireInvitations() {
  const due = await SbInvitation.findAll({ where: { state: 'PENDING', expiresAt: { [Op.lt]: new Date() } } });
  for (const inv of due) {
    const [changed] = await SbInvitation.update({ state: 'EXPIRED' }, { where: { id: inv.id, state: 'PENDING' } });
    if (!changed) continue;
    const u = await SbUser.findByPk(inv.initiatorId);
    await send(u.tgId, `⏳ Приглашение по заказу №${inv.orderId} истекло без ответа. Без штрафов — можно пригласить другого.`);
  }
  return due.length;
}

async function invalidateForOrder(orderId, note, transaction, exceptUserId = null) {
  const pending = await SbInvitation.findAll({ where: { orderId, state: 'PENDING' }, transaction });
  await SbInvitation.update({ state: 'INVALIDATED' }, { where: { orderId, state: 'PENDING' }, transaction });
  return { pending, note, exceptUserId };
}

async function notifyInvalidated({ pending, note, exceptUserId }) {
  for (const p of pending) {
    for (const uid of new Set([p.initiatorId, p.targetId])) {
      if (uid === exceptUserId) continue;
      const u = await SbUser.findByPk(uid);
      await send(u.tgId, `Приглашение по заказу №${p.orderId} больше не действует: ${note}.`);
    }
  }
}

// Unilateral cancels feed rolling counters: 3 in 24 h → 12 h pause, 5 in 7 days or 4 late → admin review.
async function applySanctions(userId) {
  const now = Date.now();
  const base = { cancelledById: userId, cancelReason: ['UNILATERAL', 'LATE'] };
  const [day, week, lateWeek] = await Promise.all([
    SbOrder.count({ where: { ...base, cancelledAt: { [Op.gt]: new Date(now - DAY) } } }),
    SbOrder.count({ where: { ...base, cancelledAt: { [Op.gt]: new Date(now - 7 * DAY) } } }),
    SbOrder.count({ where: { cancelledById: userId, cancelReason: 'LATE', cancelledAt: { [Op.gt]: new Date(now - 7 * DAY) } } }),
  ]);
  const user = await SbUser.findByPk(userId);
  const patch = {};
  if (week >= 5 || lateWeek >= 4) {
    patch.needsReview = true;
    patch.blockReason = week >= 5 ? '5 односторонних отмен за 7 дней' : '4 поздние отмены за 7 дней';
  } else if (day >= 3) {
    patch.blockedUntil = new Date(Math.max(now + 12 * HOUR, t(user.blockedUntil) || 0));
    patch.blockReason = '3 односторонние отмены за 24 часа';
  }
  if (!Object.keys(patch).length) return null;
  const before = { blockedUntil: user.blockedUntil, needsReview: user.needsReview };
  await user.update(patch);
  await SbModeration.create({ adminTgId: 0, subjectId: user.id, action: 'auto_sanction', reason: patch.blockReason, before, after: patch });
  await send(user.tgId, patch.needsReview
    ? `⛔ Новые сделки временно закрыты до проверки администратором: ${patch.blockReason}. Действующие заказы остаются доступны.`
    : `⛔ Новые сделки недоступны до ${humanDateTime(patch.blockedUntil)}: ${patch.blockReason}. Действующие заказы остаются доступны.`,
  kb([btn('Оспорить ограничение', 'appeal')]));
  return patch;
}

async function reopenSlot(order, transaction) {
  if (!order.slotId) return;
  const slot = await SbSlot.findByPk(order.slotId, { transaction, lock: transaction.LOCK.UPDATE });
  if (slot && slot.state === 'BOOKED') await slot.update({ state: t(slot.endsAt) > Date.now() ? 'OPEN' : 'EXPIRED' }, { transaction });
}

async function cancelOpenOrder(orderId, user) {
  const res = await sequelize.transaction(async (transaction) => {
    const order = await SbOrder.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order || order.creatorId !== user.id) throw new DealError('Заявка не найдена');
    if (order.status !== 'OPEN') throw new DealError('Заявка уже не открыта');
    await order.update({ status: 'CANCELLED', cancelReason: 'CREATOR', cancelledAt: new Date(), cancelledById: user.id }, { transaction });
    return invalidateForOrder(order.id, 'заказчик снял заявку', transaction, user.id);
  });
  await notifyInvalidated(res);
}

function cancelKind(order, now = Date.now()) {
  if (now - t(order.acceptedAt) <= 3 * MIN && now < t(order.startsAt)) return 'GRACE';
  return t(order.startsAt) - now < HOUR ? 'LATE' : 'UNILATERAL';
}

async function cancelAccepted(orderId, user, note = null) {
  const order = await sequelize.transaction(async (transaction) => {
    const o = await SbOrder.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!o || ![o.creatorId, o.executorId].includes(user.id)) throw new DealError('Заказ не найден');
    if (o.status !== 'ACCEPTED') throw new DealError('Заказ уже не активен');
    await o.update({ status: 'CANCELLED', cancelReason: cancelKind(o), cancelledAt: new Date(), cancelledById: user.id, cancelNote: note, mutualCancelBy: null, pendingChange: null }, { transaction });
    await reopenSlot(o, transaction);
    return o;
  });
  const other_ = await SbUser.findByPk(other(order, user.id));
  await send(other_.tgId, `❌ Заказ №${order.id} (${esc(orderWhen(order))}) отменён участником ${esc(user.nickname)}.${note ? `\nПричина: ${esc(note)}` : ''}`);
  if (['UNILATERAL', 'LATE'].includes(order.cancelReason)) await applySanctions(user.id);
  return order;
}

async function proposeMutualCancel(orderId, user) {
  const order = await SbOrder.findByPk(orderId);
  if (!order || order.status !== 'ACCEPTED' || ![order.creatorId, order.executorId].includes(user.id)) throw new DealError('Заказ не активен');
  await order.update({ mutualCancelBy: user.id });
  const u = await SbUser.findByPk(other(order, user.id));
  await send(u.tgId, `🤝 ${esc(user.nickname)} предлагает отменить заказ №${order.id} по взаимному согласию. Без штрафов для обоих.`, kb(
    [btn('Согласиться', `ma:${order.id}`), btn('Отказаться', `md:${order.id}`)],
    [btn('Передать спор', `rp:${order.id}`)],
  ));
  return order;
}

async function answerMutualCancel(orderId, user, agree) {
  const order = await sequelize.transaction(async (transaction) => {
    const o = await SbOrder.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!o || o.status !== 'ACCEPTED' || !o.mutualCancelBy || o.mutualCancelBy === user.id || ![o.creatorId, o.executorId].includes(user.id)) {
      throw new DealError('Предложение об отмене не найдено');
    }
    if (agree) {
      await o.update({ status: 'CANCELLED', cancelReason: 'MUTUAL', cancelledAt: new Date(), cancelledById: null, mutualCancelBy: null }, { transaction });
      await reopenSlot(o, transaction);
    } else {
      await o.update({ mutualCancelBy: null }, { transaction });
    }
    return o;
  });
  const u = await SbUser.findByPk(other(order, user.id));
  await send(u.tgId, agree
    ? `Заказ №${order.id} отменён по взаимному согласию. Штрафов нет.`
    : `${esc(user.nickname)} не согласен(на) на отмену. Заказ №${order.id} остаётся в силе.`, agree ? undefined : orderKb(order));
  return order;
}

// Changing date/time/place/terms after acceptance needs the other side; old terms hold until then.
async function proposeChange(orderId, user, change) {
  const order = await SbOrder.findByPk(orderId);
  if (!order || order.status !== 'ACCEPTED' || ![order.creatorId, order.executorId].includes(user.id)) throw new DealError('Заказ не активен');
  await order.update({ pendingChange: { ...change, by: user.id } });
  const u = await SbUser.findByPk(other(order, user.id));
  await send(u.tgId, `✏️ ${esc(user.nickname)} предлагает изменить заказ №${order.id}:\n${esc(change.label)}: <s>${esc(change.oldText)}</s> → <b>${esc(change.newText)}</b>`, kb(
    [btn('Принять изменения', `ca:${order.id}`), btn('Отклонить', `cd:${order.id}`)],
    [btn('К заказу', `o:${order.id}`)],
  ));
  return order;
}

async function answerChange(orderId, user, agree) {
  const order = await sequelize.transaction(async (transaction) => {
    const o = await SbOrder.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    const ch = o?.pendingChange;
    if (!o || o.status !== 'ACCEPTED' || !ch || ch.by === user.id || ![o.creatorId, o.executorId].includes(user.id)) {
      throw new DealError('Предложение изменений не найдено');
    }
    if (!agree) {
      await o.update({ pendingChange: null }, { transaction });
      return o;
    }
    const patch = { ...ch.patch };
    if (patch.startsAt) {
      patch.startsAt = new Date(patch.startsAt);
      patch.endsAt = new Date(patch.endsAt);
      const busy = await busyUserIds([o.creatorId, o.executorId], patch.startsAt, patch.endsAt, o.id, transaction);
      if (busy.size) throw new DealError('На новое время у одного из участников уже есть заказ');
    }
    await o.update({ ...patch, pendingChange: null, revision: o.revision + 1 }, { transaction });
    return o;
  });
  const u = await SbUser.findByPk(other(order, user.id));
  await send(u.tgId, agree ? `✅ Изменения заказа №${order.id} приняты.\n\n${orderBody(order)}` : `Изменения заказа №${order.id} отклонены, действуют прежние условия.`, orderKb(order));
  return order;
}

async function confirmCompletion(orderId, user) {
  const res = await sequelize.transaction(async (transaction) => {
    const o = await SbOrder.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!o || ![o.creatorId, o.executorId].includes(user.id)) throw new DealError('Заказ не найден');
    if (o.status === 'COMPLETED') return { order: o, done: true, already: true };
    if (o.status !== 'ACCEPTED') throw new DealError('Заказ не активен');
    await SbCompletion.findOrCreate({ where: { orderId: o.id, userId: user.id }, defaults: { orderId: o.id, userId: user.id }, transaction });
    const count = await SbCompletion.count({ where: { orderId: o.id }, transaction });
    if (count >= 2) {
      await o.update({ status: 'COMPLETED', completedAt: new Date(), mutualCancelBy: null, pendingChange: null }, { transaction });
      return { order: o, done: true };
    }
    return { order: o, done: false };
  });
  const { order, done, already } = res;
  if (already) return res;
  const u = await SbUser.findByPk(other(order, user.id));
  if (done) {
    const ask = (id) => kb([1, 2, 3, 4, 5].map((n) => btn('⭐'.repeat(1) + n, `rv:${id}:${n}`)), [btn('Пропустить', `rs:${id}`)]);
    const me = await SbUser.findByPk(user.id);
    for (const [to, about] of [[me, u], [u, me]]) {
      await send(to.tgId, `🎉 Заказ №${order.id} выполнен. Оцените ${esc(about.nickname)} от 1 до 5. Оценка не публичная, средний рейтинг откроется после обеих оценок или через 48 часов.`, ask(order.id));
    }
  } else {
    await send(u.tgId, `${esc(user.nickname)} отметил(а) заказ №${order.id} выполненным. Подтвердите, если всё так.`, kb(
      [btn('✅ Выполнено', `ok:${order.id}`), btn('Ещё не выполнено', `o:${order.id}`)],
      [btn('Сообщить о проблеме', `op:${order.id}`)],
    ));
  }
  return res;
}

async function submitReview(orderId, user, rating, comment = null) {
  const order = await SbOrder.findByPk(orderId);
  if (!order || order.status !== 'COMPLETED' || ![order.creatorId, order.executorId].includes(user.id)) throw new DealError('Оценить можно только выполненный заказ');
  if (!(rating >= 1 && rating <= 5)) throw new DealError('Оценка от 1 до 5');
  const toId = other(order, user.id);
  const [review, created] = await SbReview.findOrCreate({
    where: { orderId, fromId: user.id },
    defaults: {
      orderId, fromId: user.id, toId, role: roleIn(order, toId), rating, comment, revealAfter: new Date(t(order.completedAt) + 48 * HOUR),
    },
  });
  if (!created) throw new DealError('Вы уже оценили этот заказ');
  if (await SbReview.count({ where: { orderId } }) >= 2) await SbReview.update({ revealed: true }, { where: { orderId } });
  return review;
}

module.exports = {
  INVITE_LIMIT,
  DealError,
  ttlFor,
  other,
  roleIn,
  invite,
  acceptInvitation,
  respondInvitation,
  expireInvitations,
  invalidateForOrder,
  notifyInvalidated,
  cancelOpenOrder,
  cancelAccepted,
  cancelKind,
  applySanctions,
  proposeMutualCancel,
  answerMutualCancel,
  proposeChange,
  answerChange,
  confirmCompletion,
  submitReview,
};

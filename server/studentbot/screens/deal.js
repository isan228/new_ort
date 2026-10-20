const { Op } = require('sequelize');
const {
  SbUser, SbOrder, SbSlot, SbInvitation, SbMessage, SbCompletion, SbReview,
} = require('../models');
const { setState, requireDeal, loadConfig } = require('../ctx');
const { executorsForOrder, ordersForExecutor, resolvePlace } = require('../matching');
const deals = require('../deals');
const {
  todayLocal, humanDate, pairInterval, pairLabel, parseRange, MIN,
} = require('../time');
const { tg } = require('../../utils/telegram');
const {
  esc, btn, kb, show, send, orderBody, orderWhen, orderKb, ratingsFor, ratingText, slotText, personHead,
} = require('../ui');

const PAGE = 5;
const MATCH_NOTIFY_PER_DAY = 3;

async function guard(ctx, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof deals.DealError) {
      if (err.message === 'NO_ACCESS') return requireDeal(ctx);
      return ctx.answer(err.message, true);
    }
    throw err;
  }
}

// ---------- Customer side: compatible executors ----------

async function executorFeed(ctx, orderId, page = 0, { justPublished = false } = {}) {
  const order = await SbOrder.findByPk(orderId);
  if (!order || order.creatorId !== ctx.user.id) return ctx.answer('Заявка не найдена');
  if (order.status !== 'OPEN') return openOrderCard(ctx, order.id);
  const list = await executorsForOrder(order, ctx.user);
  await setState(ctx, null, { feed: { kind: 'exec', orderId, ids: list.map((f) => f.slot.id), page } });
  const ratings = await ratingsFor(list.map((f) => f.user.id));
  const slice = list.slice(page * PAGE, page * PAGE + PAGE);
  const head = justPublished ? `✅ Заявка №${order.id} опубликована.\n` : `Заявка №${order.id}: ${esc(orderWhen(order))}\n`;
  const body = list.length
    ? `Подходящие исполнители: <b>${list.length}</b>\n\n${slice.map((f, i) => `${page * PAGE + i + 1}. ${esc(f.user.nickname)} · ${esc(f.user.faculty)}, ${f.user.course} курс · ${ratingText(ratings.get(f.user.id).executor)}`).join('\n')}`
    : 'Подходящих исполнителей пока нет. Мы сообщим, когда кто-то освободится на это время.';
  return show(ctx, head + body, kb(
    ...slice.map((f, i) => [btn(`👤 ${page * PAGE + i + 1}. ${f.user.nickname}`, `fx:${orderId}:${page * PAGE + i}`)]),
    [page > 0 ? btn('◀ Назад', `fe:${orderId}:${page - 1}`) : null, (page + 1) * PAGE < list.length ? btn('Далее ▶', `fe:${orderId}:${page + 1}`) : null].filter(Boolean),
    [btn('Мои заявки', 'my:active')],
  ));
}

async function executorCard(ctx, orderId, idx) {
  const feed = ctx.state.data.feed;
  if (!feed || feed.kind !== 'exec' || feed.orderId !== orderId) return executorFeed(ctx, orderId);
  const slotId = feed.ids[idx];
  if (!slotId) return executorFeed(ctx, orderId, feed.page || 0);
  const slot = await SbSlot.findByPk(slotId);
  const user = slot && await SbUser.findByPk(slot.userId);
  if (!slot || !user || slot.state !== 'OPEN') return ctx.answer('Этот исполнитель уже недоступен');
  const ratings = await ratingsFor([user.id]);
  const r = ratings.get(user.id);
  return show(ctx, `${personHead(user)}\nКак исполнитель: ${ratingText(r.executor)} · выполнено ${r.done}\nСвободен: ${esc(slotText(slot))}`, kb(
    [btn('Пригласить', `fi:${orderId}:${slot.id}`)],
    [btn('Назад', `fe:${orderId}:${feed.page || 0}`), idx + 1 < feed.ids.length ? btn('Следующий', `fx:${orderId}:${idx + 1}`) : null].filter(Boolean),
    [btn('Пожаловаться', `ru:${user.id}:${orderId}`)],
  ));
}

async function inviteSent(ctx, inv, target) {
  const minutes = Math.max(1, Math.round((new Date(inv.expiresAt) - Date.now()) / MIN));
  return show(ctx, `📨 Предложение отправлено ${esc(target.nickname)}. На ответ: ${minutes} мин. Первый подтвердивший получает заказ.`, kb(
    [btn('Ожидающие приглашения', 'my:inv'), btn('Отменить приглашение', `ic:${inv.id}`)],
    [inv.initiatorRole === 'customer' ? btn('Выбрать другого', `fe:${inv.orderId}:0`) : btn('Другие заказы', 'fo:0'), btn('Мои', 'my')],
  ));
}

async function inviteExecutor(ctx, orderId, slotId) {
  if (!await requireDeal(ctx)) return null;
  return guard(ctx, async () => {
    const [order, slot] = await Promise.all([SbOrder.findByPk(orderId), SbSlot.findByPk(slotId)]);
    if (!order || order.creatorId !== ctx.user.id || !slot) throw new deals.DealError('Заявка не найдена');
    const inv = await deals.invite({ order, slot, initiator: ctx.user });
    return inviteSent(ctx, inv, await SbUser.findByPk(slot.userId));
  });
}

// ---------- Executor side: compatible orders ----------

async function orderFeed(ctx, page = 0, { header = '' } = {}) {
  const list = await ordersForExecutor(ctx.user);
  await setState(ctx, null, { feed: { kind: 'ord', ids: list.map((r) => `${r.order.id}:${r.slot.id}`), page } });
  const ratings = await ratingsFor(list.map((r) => r.customer.id));
  const slice = list.slice(page * PAGE, page * PAGE + PAGE);
  const body = list.length
    ? `Найдено подходящих заказов: <b>${list.length}</b>\n\n${slice.map((r, i) => `${page * PAGE + i + 1}. ${esc(orderWhen(r.order))} · ${esc(r.order.placeText)} · ${esc(r.order.subject || 'без предмета')} · ${ratingText(ratings.get(r.customer.id).customer)}`).join('\n')}`
    : 'Подходящих заказов пока нет. Мы сообщим, когда появятся заявки на ваше время.';
  return show(ctx, `${header ? `${header}\n\n` : ''}${body}`, kb(
    ...slice.map((r, i) => [btn(`📄 ${page * PAGE + i + 1}. ${humanDate(r.order.date)} · ${r.order.placeText}`.slice(0, 60), `fc:${page * PAGE + i}`)]),
    [page > 0 ? btn('◀ Назад', `fo:${page - 1}`) : null, (page + 1) * PAGE < list.length ? btn('Далее ▶', `fo:${page + 1}`) : null].filter(Boolean),
    [btn('Мои слоты', 'my:slots')],
  ));
}

async function customerCardText(order, customer) {
  const ratings = await ratingsFor([customer.id]);
  return `${personHead(customer)}\nКак заказчик: ${ratingText(ratings.get(customer.id).customer)}\n\n${orderBody(order)}`;
}

async function orderCard(ctx, idx) {
  const feed = ctx.state.data.feed;
  if (!feed || feed.kind !== 'ord') return orderFeed(ctx);
  const ref = feed.ids[idx];
  if (!ref) return orderFeed(ctx, feed.page || 0);
  const [orderId, slotId] = ref.split(':').map(Number);
  const order = await SbOrder.findByPk(orderId);
  if (!order || order.status !== 'OPEN') return ctx.answer('Заявка уже неактуальна');
  const customer = await SbUser.findByPk(order.creatorId);
  return show(ctx, await customerCardText(order, customer), kb(
    [btn('Откликнуться', `fr:${orderId}:${slotId}`)],
    [btn('Назад', `fo:${feed.page || 0}`), idx + 1 < feed.ids.length ? btn('Следующий', `fc:${idx + 1}`) : null].filter(Boolean),
    [btn('Пожаловаться', `ru:${customer.id}:${orderId}`)],
  ));
}

async function viewOrder(ctx, orderId) {
  const order = await SbOrder.findByPk(orderId);
  if (!order || order.status !== 'OPEN') return show(ctx, 'Эта заявка уже неактуальна.');
  const match = (await ordersForExecutor(ctx.user)).find((r) => r.order.id === orderId);
  if (!match) return show(ctx, 'Заявка больше не подходит под ваши свободные слоты.');
  return show(ctx, await customerCardText(order, match.customer), kb(
    [btn('Откликнуться', `fr:${orderId}:${match.slot.id}`)],
    [btn('Все подходящие заказы', 'fo:0'), btn('Пожаловаться', `ru:${match.customer.id}:${orderId}`)],
  ));
}

async function respond(ctx, orderId, slotId) {
  if (!await requireDeal(ctx)) return null;
  return guard(ctx, async () => {
    const [order, slot] = await Promise.all([SbOrder.findByPk(orderId), SbSlot.findByPk(slotId)]);
    if (!order || !slot) throw new deals.DealError('Заявка не найдена');
    const inv = await deals.invite({ order, slot, initiator: ctx.user });
    return inviteSent(ctx, inv, await SbUser.findByPk(order.creatorId));
  });
}

// ---------- Match notifications (opt-in, at most 3 a day) ----------

async function matchNotify(user, text, markup) {
  if (!user.notifyMatches) return;
  const today = todayLocal();
  const count = user.matchNotifyDay === today ? user.matchNotifyCount : 0;
  if (count >= MATCH_NOTIFY_PER_DAY) return;
  await user.update({ matchNotifyDay: today, matchNotifyCount: count + 1 });
  await send(user.tgId, text, markup);
}

async function notifyExecutorsAboutOrder(order, customer) {
  for (const { user } of await executorsForOrder(order, customer)) {
    await matchNotify(user, `🔎 Новая подходящая заявка: ${esc(orderWhen(order))} · ${esc(order.placeText)}`, kb([btn('Открыть', `vo:${order.id}`)]));
  }
}

async function notifyCustomersAboutSlots(slots, executor) {
  const seen = new Set();
  for (const { order, customer } of await ordersForExecutor(executor, slots)) {
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    await matchNotify(customer, `🔎 Появился подходящий исполнитель для заявки №${order.id} (${esc(orderWhen(order))}).`, kb([btn('Посмотреть', `fe:${order.id}:0`)]));
  }
}

// ---------- Invitations ----------

async function invitationAccept(ctx, invId) {
  return guard(ctx, async () => {
    const order = await deals.acceptInvitation(invId, ctx.user);
    await ctx.answer('Заказ подтверждён');
    return show(ctx, `✅ Вы приняли заказ №${order.id}. Детали — в сообщении ниже.`);
  });
}

async function invitationDecline(ctx, invId) {
  return guard(ctx, async () => {
    await deals.respondInvitation(invId, ctx.user, 'DECLINED');
    return show(ctx, 'Вы отказались от приглашения. Штрафов нет.');
  });
}

async function invitationCancel(ctx, invId) {
  return guard(ctx, async () => {
    await deals.respondInvitation(invId, ctx.user, 'CANCELLED');
    return show(ctx, 'Приглашение отозвано.', kb([btn('Мои', 'my')]));
  });
}

async function invitationProfile(ctx, invId) {
  const inv = await SbInvitation.findByPk(invId);
  if (!inv || inv.targetId !== ctx.user.id) return ctx.answer('Приглашение не найдено');
  const from = await SbUser.findByPk(inv.initiatorId);
  const r = (await ratingsFor([from.id])).get(from.id);
  return send(ctx.chatId, `${personHead(from)}\nКак заказчик: ${ratingText(r.customer)}\nКак исполнитель: ${ratingText(r.executor)}\nВыполнено заказов: ${r.done}`, kb(
    [btn('✅ Принять', `ia:${inv.id}`), btn('Отказаться', `id:${inv.id}`)],
  ));
}

// ---------- «Мои» ----------

async function myMenu(ctx) {
  await setState(ctx, null);
  return show(ctx, 'Мои: активные заявки, приглашения, подтверждённые заказы, свободные слоты и история.', kb(
    [btn('Активные заказы', 'my:active'), btn('Приглашения', 'my:inv')],
    [btn('Свободные слоты', 'my:slots'), btn('История', 'my:hist')],
  ));
}

async function myActive(ctx) {
  const id = ctx.user.id;
  const orders = await SbOrder.findAll({
    where: { [Op.or]: [{ creatorId: id, status: ['OPEN', 'ACCEPTED'] }, { executorId: id, status: 'ACCEPTED' }] },
    order: [['startsAt', 'ASC']],
    limit: 20,
  });
  if (!orders.length) return show(ctx, 'Активных заявок и заказов нет.', kb([btn('Мои', 'my')]));
  const line = (o) => `№${o.id} · ${o.status === 'OPEN' ? '🟡 ищем исполнителя' : '🟢 подтверждён'} · ${orderWhen(o)} · ${o.placeText}`;
  return show(ctx, `<b>Активные</b>\n\n${orders.map((o) => esc(line(o))).join('\n')}`, kb(
    ...orders.map((o) => [btn(`№${o.id} · ${humanDate(o.date)} · ${o.creatorId === id ? 'я заказчик' : 'я исполнитель'}`, o.status === 'OPEN' ? `my:open:${o.id}` : `o:${o.id}`)]),
    [btn('Мои', 'my')],
  ));
}

async function myInvitations(ctx) {
  const id = ctx.user.id;
  const invs = await SbInvitation.findAll({
    where: { state: 'PENDING', [Op.or]: [{ initiatorId: id }, { targetId: id }] },
    order: [['expiresAt', 'ASC']],
  });
  if (!invs.length) return show(ctx, 'Ожидающих приглашений нет.', kb([btn('Мои', 'my')]));
  const rows = [];
  const lines = [];
  for (const inv of invs) {
    const order = await SbOrder.findByPk(inv.orderId);
    const incoming = inv.targetId === id;
    const minutes = Math.max(0, Math.round((new Date(inv.expiresAt) - Date.now()) / MIN));
    lines.push(`${incoming ? '⬅️ входящее' : '➡️ исходящее'} · №${order.id} · ${orderWhen(order)} · ещё ${minutes} мин.`);
    rows.push(incoming
      ? [btn(`✅ Принять №${order.id}`, `ia:${inv.id}`), btn('Отказаться', `id:${inv.id}`)]
      : [btn(`Отозвать №${order.id}`, `ic:${inv.id}`)]);
  }
  return show(ctx, `<b>Приглашения</b>\n\n${lines.map(esc).join('\n')}`, kb(...rows, [btn('Мои', 'my')]));
}

async function mySlots(ctx) {
  const slots = await SbSlot.findAll({ where: { userId: ctx.user.id, state: ['OPEN', 'BOOKED'], endsAt: { [Op.gt]: new Date() } }, order: [['startsAt', 'ASC']] });
  if (!slots.length) return show(ctx, 'Свободных слотов нет.', kb([btn('Добавить доступность', 'sf:restart')], [btn('Мои', 'my')]));
  return show(ctx, `<b>Свободные слоты</b>\n\n${slots.map((s) => `${s.state === 'BOOKED' ? '🔒' : '🟢'} ${esc(slotText(s))}`).join('\n')}`, kb(
    ...slots.filter((s) => s.state === 'OPEN').map((s) => [btn(`🗑 ${humanDate(s.date)} ${pairLabel(s.pairType, s.startsAt, s.endsAt)}`.slice(0, 60), `sx:${s.id}`)]),
    [btn('Найти заказы', 'fo:0'), btn('Мои', 'my')],
  ));
}

async function myHistory(ctx) {
  const id = ctx.user.id;
  const orders = await SbOrder.findAll({
    where: { status: ['COMPLETED', 'CANCELLED'], [Op.or]: [{ creatorId: id }, { executorId: id }] },
    order: [['updatedAt', 'DESC']],
    limit: 10,
  });
  if (!orders.length) return show(ctx, 'История пока пуста.', kb([btn('Мои', 'my')]));
  const reason = { EXPIRED: 'истекло', CREATOR: 'снята', UNILATERAL: 'отменён', LATE: 'поздняя отмена', GRACE: 'отменён сразу', MUTUAL: 'взаимная отмена', ADMIN: 'отменён администратором' };
  const line = (o) => `№${o.id} · ${orderWhen(o)} · ${o.status === 'COMPLETED' ? '✅ выполнен' : `❌ ${reason[o.cancelReason] || 'отменён'}`}`;
  return show(ctx, `<b>История</b>\n\n${orders.map((o) => esc(line(o))).join('\n')}`, kb(
    ...orders.filter((o) => o.creatorId === id).slice(0, 5).map((o) => [btn(`Повторить заявку №${o.id}`, `ocopy:${o.id}`)]),
    [btn('Мои', 'my')],
  ));
}

async function openOrderCard(ctx, orderId) {
  const order = await SbOrder.findByPk(orderId);
  if (!order || order.creatorId !== ctx.user.id) return ctx.answer('Заявка не найдена');
  if (order.status === 'ACCEPTED') return acceptedCard(ctx, order.id);
  if (order.status !== 'OPEN') return show(ctx, `Заявка №${order.id} уже закрыта.`, kb([btn('История', 'my:hist')]));
  const pending = await SbInvitation.count({ where: { orderId: order.id, state: 'PENDING' } });
  return show(ctx, `<b>Заявка №${order.id}</b> · ищем исполнителя\n\n${orderBody(order)}\n\nОжидающих приглашений: ${pending}`, kb(
    [btn('Подходящие исполнители', `fe:${order.id}:0`)],
    [btn('Изменить', `oe:${order.id}`), btn('Отменить заявку', `oxo:${order.id}`)],
    [btn('Мои', 'my')],
  ));
}

async function editOpenOrder(ctx, orderId) {
  if (!await requireDeal(ctx)) return null;
  const o = await SbOrder.findByPk(orderId);
  if (!o || o.creatorId !== ctx.user.id || o.status !== 'OPEN') return ctx.answer('Заявку уже нельзя изменить');
  await setState(ctx, 'of_preview', {
    of: {
      orderId: o.id,
      date: o.date,
      pairType: o.pairType,
      startsAt: new Date(o.startsAt).toISOString(),
      endsAt: new Date(o.endsAt).toISOString(),
      placeKey: o.placeKey,
      placeText: o.placeText,
      requiredSex: o.requiredSex,
      facultyMode: o.facultyMode,
      faculty: o.faculty,
      subject: o.subject,
      description: o.description,
      compensation: o.compensation,
      comment: o.comment,
      editing: true,
    },
  });
  // eslint-disable-next-line global-require
  return require('./order').onCallback(ctx, 'of:edit');
}

async function deleteSlot(ctx, slotId) {
  const slot = await SbSlot.findByPk(slotId);
  if (!slot || slot.userId !== ctx.user.id || slot.state !== 'OPEN') return ctx.answer('Слот уже недоступен');
  await slot.update({ state: 'DELETED' });
  const pending = await SbInvitation.findAll({ where: { slotId: slot.id, state: 'PENDING' } });
  await SbInvitation.update({ state: 'INVALIDATED' }, { where: { slotId: slot.id, state: 'PENDING' } });
  await deals.notifyInvalidated({ pending, note: 'исполнитель убрал это время', exceptUserId: ctx.user.id });
  return mySlots(ctx);
}

// ---------- Accepted order ----------

async function participantOrder(ctx, orderId, statuses = ['ACCEPTED']) {
  const order = await SbOrder.findByPk(orderId);
  if (!order || ![order.creatorId, order.executorId].includes(ctx.user.id)) {
    await ctx.answer('Заказ не найден');
    return null;
  }
  if (!statuses.includes(order.status)) {
    await ctx.answer('Заказ уже не активен');
    return null;
  }
  return order;
}

async function acceptedCard(ctx, orderId) {
  const order = await participantOrder(ctx, orderId, ['ACCEPTED', 'COMPLETED', 'CANCELLED']);
  if (!order) return null;
  const other = await SbUser.findByPk(deals.other(order, ctx.user.id));
  const role = order.creatorId === ctx.user.id ? 'вы заказчик' : 'вы исполнитель';
  const done = await SbCompletion.count({ where: { orderId: order.id } });
  const status = { ACCEPTED: `подтверждён${done ? ` · отметок «Выполнено»: ${done}/2` : ''}`, COMPLETED: 'выполнен', CANCELLED: 'отменён' }[order.status];
  return show(ctx, `<b>Заказ №${order.id}</b> · ${status}\nУчастник: <b>${esc(other.nickname)}</b> (${role})\n\n${orderBody(order)}`,
    order.status === 'ACCEPTED' ? orderKb(order) : kb([btn('Мои', 'my')]));
}

const TEMPLATES = {
  customer: (o) => `Предмет: ${o.subject || '—'}\nНачало: ${orderWhen(o)}\nПреподаватель: \nДетали: `,
  executor: () => 'Как ко мне обращаться: \nWhatsApp (по желанию): \nДетали: ',
};

async function openChat(ctx, orderId) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  await setState(ctx, 'chat', { chatOrderId: order.id });
  const role = deals.roleIn(order, ctx.user.id);
  return show(ctx, `💬 Переписка по заказу №${order.id}. Отправьте текст, фото или документ — я перешлю участнику. Не публикуйте лишние персональные данные.`, kb(
    [btn(role === 'customer' ? 'Шаблон заказчика' : 'Шаблон исполнителя', `ot:${order.id}`)],
    [btn('Отправить контакт', `ocn:${order.id}`), btn('К заказу', `o:${order.id}`)],
  ));
}

async function sendTemplate(ctx, orderId) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  await setState(ctx, 'chat', { chatOrderId: order.id });
  await send(ctx.chatId, `Скопируйте шаблон, заполните и отправьте сюда — я перешлю участнику:\n\n<code>${esc(TEMPLATES[deals.roleIn(order, ctx.user.id)](order))}</code>`);
  return null;
}

async function contactMenu(ctx, orderId) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  if (!ctx.user.username) return ctx.answer('У вас не установлен @username');
  return show(ctx, 'Что отправить участнику? Контакт нельзя гарантированно удалить после отправки.', kb(
    [btn(`@${ctx.user.username}`, `ocs:${order.id}:u`)],
    ctx.user.whatsapp ? [btn(`@${ctx.user.username} + WhatsApp`, `ocs:${order.id}:w`)] : null,
    [btn('К заказу', `o:${order.id}`)],
  ));
}

async function relay(order, from, payload) {
  const to = await SbUser.findByPk(deals.other(order, from.id));
  const head = `💬 Заказ №${order.id} · ${esc(from.nickname)}:`;
  const reply = kb([btn('Ответить', `oc:${order.id}`), btn('К заказу', `o:${order.id}`)]);
  let ok = true;
  try {
    if (payload.type === 'text' || payload.type === 'contact' || payload.type === 'template') {
      await tg('sendMessage', { chat_id: to.tgId, text: `${head}\n${esc(payload.text)}`, parse_mode: 'HTML', reply_markup: reply });
    } else {
      await tg('copyMessage', {
        chat_id: to.tgId, from_chat_id: from.tgId, message_id: payload.messageId, caption: `${head}${payload.text ? `\n${esc(payload.text)}` : ''}`, parse_mode: 'HTML', reply_markup: reply,
      });
    }
  } catch (err) {
    ok = false;
    if (err.code === 403) await to.update({ chatUnreachable: true });
    console.warn('studentbot relay:', err.message);
  }
  await SbMessage.create({ orderId: order.id, fromId: from.id, toId: to.id, type: payload.type, text: payload.text || null, fileId: payload.fileId || null, delivered: ok });
  return ok;
}

async function sendContact(ctx, orderId, withWa) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  const text = `Мой Telegram: @${ctx.user.username}${withWa && ctx.user.whatsapp ? `\nWhatsApp: ${ctx.user.whatsapp}` : ''}`;
  const ok = await relay(order, ctx.user, { type: 'contact', text });
  return show(ctx, ok ? 'Контакт отправлен участнику.' : 'Не удалось доставить сообщение — участник недоступен в Telegram. Заказ остаётся в силе.', orderKb(order));
}

// Messages typed while a chat is open go to the other participant of that order only.
async function onChatMessage(ctx, msg) {
  const order = await SbOrder.findByPk(ctx.state.data.chatOrderId);
  if (!order || order.status !== 'ACCEPTED' || ![order.creatorId, order.executorId].includes(ctx.user.id)) {
    await setState(ctx, null);
    return send(ctx.chatId, 'Переписка по этому заказу закрыта.');
  }
  let payload;
  if (msg.text) payload = { type: 'text', text: msg.text.slice(0, 3000) };
  else if (msg.photo) payload = { type: 'photo', messageId: msg.message_id, fileId: msg.photo[msg.photo.length - 1].file_id, text: msg.caption || null };
  else if (msg.document) {
    if (msg.document.file_size > 20 * 1024 * 1024) return send(ctx.chatId, 'Файл больше 20 МБ — отправьте поменьше.');
    payload = { type: 'document', messageId: msg.message_id, fileId: msg.document.file_id, text: msg.caption || null };
  } else return send(ctx.chatId, 'Можно отправить текст, фото или документ. Голосовые, видео и стикеры не пересылаются.');
  const ok = await relay(order, ctx.user, payload);
  return send(ctx.chatId, ok ? '✓ Отправлено' : 'Не удалось доставить — участник недоступен в Telegram. Заказ остаётся в силе.', ok ? undefined : orderKb(order));
}

const PROBLEMS = {
  late: 'Опаздываю', noans: 'Нет ответа', place: 'Не могу найти место', cant: 'Не могу выполнить',
};

async function problemMenu(ctx, orderId) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  return show(ctx, `Что произошло с заказом №${order.id}?`, kb(
    [btn('Опаздываю', `pt:${order.id}:late`), btn('Нет ответа', `pt:${order.id}:noans`)],
    [btn('Не могу найти место', `pt:${order.id}:place`), btn('Не могу выполнить', `pt:${order.id}:cant`)],
    [btn('Другое', `pt:${order.id}:other`), btn('Жалоба администратору', `rp:${order.id}`)],
    [btn('К заказу', `o:${order.id}`)],
  ));
}

async function problemSend(ctx, orderId, code, customText = null) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  if (code === 'other' && !customText) {
    await setState(ctx, 'problem_text', { problemOrderId: order.id });
    return show(ctx, 'Опишите, что случилось — я передам участнику.', kb([btn('К заказу', `o:${order.id}`)]));
  }
  const text = `⚠️ ${PROBLEMS[code] || customText}`;
  const ok = await relay(order, ctx.user, { type: 'template', text });
  if (code === 'other') await setState(ctx, null);
  return send(ctx.chatId, ok ? 'Сообщение передано участнику. Это не отмена и не штраф.' : 'Не удалось доставить сообщение участнику.', orderKb(order));
}

async function moreMenu(ctx, orderId) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  return show(ctx, `Заказ №${order.id}: дополнительные действия.`, kb(
    [btn('Изменить условия', `och:${order.id}`)],
    [btn('Предложить взаимную отмену', `omc:${order.id}`)],
    [btn('Отменить заказ', `ox:${order.id}`)],
    [btn('К заказу', `o:${order.id}`)],
  ));
}

async function cancelAsk(ctx, orderId) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  const kind = deals.cancelKind(order);
  const note = {
    GRACE: 'Вы приняли заказ меньше 3 минут назад — отмена без последствий.',
    LATE: 'До начала меньше 60 минут — это поздняя отмена, она учитывается в счётчиках ограничений.',
    UNILATERAL: 'Односторонняя отмена учитывается в счётчиках: 3 за 24 часа — пауза 12 часов. Без последствий можно предложить взаимную отмену.',
  }[kind];
  return show(ctx, `Отменить заказ №${order.id}?\n\n${note}`, kb(
    [btn('Да, отменить', `oxy:${order.id}`), btn('Нет', `o:${order.id}`)],
    kind !== 'GRACE' ? [btn('Предложить взаимную отмену', `omc:${order.id}`)] : null,
  ));
}

async function changeMenu(ctx, orderId) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  if (order.pendingChange) return ctx.answer('Уже есть предложение изменений — дождитесь ответа');
  return show(ctx, 'Что изменить? Новые условия начнут действовать после согласия участника.', kb(
    [btn('Пару / время', `chf:${order.id}:time`), btn('Место', `chf:${order.id}:place`)],
    [btn('Вознаграждение', `chf:${order.id}:comp`)],
    [btn('К заказу', `o:${order.id}`)],
  ));
}

async function changeField(ctx, orderId, field) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  const cfg = await loadConfig();
  await setState(ctx, 'change_value', { change: { orderId: order.id, field } });
  if (field === 'time') {
    return show(ctx, 'Выберите новую пару (в тот же день) или напишите интервал, например 10:00-11:30.', kb(
      ['1', '2', '3', '4'].map((n) => btn(`${n}-я`, `chp:${order.id}:${n}`)),
      [btn('К заказу', `o:${order.id}`)],
    ));
  }
  if (field === 'place') {
    return show(ctx, 'Выберите место или напишите название.', kb(
      ...cfg.places.map((p) => [btn(p.name, `chl:${order.id}:${p.key}`)]),
      [btn('К заказу', `o:${order.id}`)],
    ));
  }
  return show(ctx, 'Напишите новые условия вознаграждения.', kb([btn('К заказу', `o:${order.id}`)]));
}

async function proposeChange(ctx, orderId, field, value) {
  const order = await participantOrder(ctx, orderId);
  if (!order) return null;
  const cfg = await loadConfig();
  let change;
  if (field === 'time') {
    const interval = typeof value === 'string'
      ? pairInterval(order.date, value, cfg.pairs)
      : pairInterval(order.date, 'other', cfg.pairs, value);
    if (!interval || interval.endsAt <= new Date()) return send(ctx.chatId, 'Это время не подходит.');
    const pairType = typeof value === 'string' ? value : 'other';
    change = {
      label: 'Время', oldText: pairLabel(order.pairType, order.startsAt, order.endsAt), newText: pairLabel(pairType, interval.startsAt, interval.endsAt), patch: { pairType, ...interval },
    };
  } else if (field === 'place') {
    const place = cfg.places.find((p) => p.key === value) ? { key: value, text: cfg.places.find((p) => p.key === value).name } : resolvePlace(value, cfg);
    change = {
      label: 'Место', oldText: order.placeText, newText: place.text, patch: { placeKey: place.key, placeText: place.text },
    };
  } else {
    change = {
      label: 'Вознаграждение', oldText: order.compensation, newText: String(value).slice(0, 200), patch: { compensation: String(value).slice(0, 200) },
    };
  }
  await setState(ctx, null);
  return guard(ctx, async () => {
    await deals.proposeChange(order.id, ctx.user, change);
    return send(ctx.chatId, 'Предложение изменений отправлено участнику. До его согласия действуют прежние условия.', orderKb(order));
  });
}

// ---------- Completion and reviews ----------

async function complete(ctx, orderId) {
  return guard(ctx, async () => {
    const res = await deals.confirmCompletion(orderId, ctx.user);
    if (res.already) return ctx.answer('Заказ уже выполнен');
    if (!res.done) return show(ctx, `Отмечено. Ждём подтверждения второго участника по заказу №${orderId}.`, kb([btn('К заказу', `o:${orderId}`)]));
    return null;
  });
}

async function pickRating(ctx, orderId, rating) {
  const order = await participantOrder(ctx, orderId, ['COMPLETED']);
  if (!order) return null;
  if (await SbReview.count({ where: { orderId, fromId: ctx.user.id } })) return ctx.answer('Вы уже оценили этот заказ');
  await setState(ctx, 'review_comment', { review: { orderId, rating } });
  return show(ctx, `Ваша оценка: ${'⭐'.repeat(rating)}\nНапишите комментарий (необязательно, его увидит только администрация) или нажмите «Отправить».`, kb(
    [1, 2, 3, 4, 5].map((n) => btn(n === rating ? `✅${n}` : String(n), `rv:${orderId}:${n}`)),
    [btn('Отправить', `rvs:${orderId}`), btn('Пропустить', `rs:${orderId}`)],
  ));
}

async function submitRating(ctx, orderId, comment = null) {
  const review = ctx.state.data.review;
  if (!review || review.orderId !== orderId) return ctx.answer('Сначала выберите оценку');
  return guard(ctx, async () => {
    await deals.submitReview(orderId, ctx.user, review.rating, comment);
    await setState(ctx, null, { review: null });
    return show(ctx, 'Спасибо! Оценка сохранена. Средний рейтинг откроется после обеих оценок или через 48 часов.', kb([btn('Мои', 'my')]));
  });
}

// ---------- Router ----------

async function onCallback(ctx, data) {
  const [key, a, b] = data.split(':');
  const n = (v) => Number(v);
  switch (key) {
    case 'fe': return executorFeed(ctx, n(a), n(b) || 0);
    case 'fx': return executorCard(ctx, n(a), n(b));
    case 'fi': return inviteExecutor(ctx, n(a), n(b));
    case 'fo': if (!await requireDeal(ctx)) return null; return orderFeed(ctx, n(a) || 0);
    case 'fc': return orderCard(ctx, n(a));
    case 'fr': return respond(ctx, n(a), n(b));
    case 'vo': if (!await requireDeal(ctx)) return null; return viewOrder(ctx, n(a));
    case 'ia': return invitationAccept(ctx, n(a));
    case 'id': return invitationDecline(ctx, n(a));
    case 'ic': return invitationCancel(ctx, n(a));
    case 'ip': return invitationProfile(ctx, n(a));
    case 'my':
      if (!a) return myMenu(ctx);
      if (a === 'active') return myActive(ctx);
      if (a === 'inv') return myInvitations(ctx);
      if (a === 'slots') return mySlots(ctx);
      if (a === 'hist') return myHistory(ctx);
      if (a === 'open') return openOrderCard(ctx, n(b));
      return myMenu(ctx);
    case 'oe': return editOpenOrder(ctx, n(a));
    case 'oxo': return guard(ctx, async () => {
      await deals.cancelOpenOrder(n(a), ctx.user);
      return show(ctx, `Заявка №${a} снята.`, kb([btn('Мои', 'my')]));
    });
    case 'ocopy': {
      const o = await SbOrder.findByPk(n(a));
      if (!o || o.creatorId !== ctx.user.id) return ctx.answer('Заявка не найдена');
      // eslint-disable-next-line global-require
      return require('./order').startOrder(ctx, o);
    }
    case 'sx': return deleteSlot(ctx, n(a));
    case 'o': await setState(ctx, null); return acceptedCard(ctx, n(a));
    case 'oc': return openChat(ctx, n(a));
    case 'od':
    case 'ot': return sendTemplate(ctx, n(a));
    case 'ocn': return contactMenu(ctx, n(a));
    case 'ocs': return sendContact(ctx, n(a), b === 'w');
    case 'ok': return complete(ctx, n(a));
    case 'op': return problemMenu(ctx, n(a));
    case 'pt': return problemSend(ctx, n(a), b);
    case 'om': return moreMenu(ctx, n(a));
    case 'ox': return cancelAsk(ctx, n(a));
    case 'oxy': return guard(ctx, async () => {
      const order = await deals.cancelAccepted(n(a), ctx.user);
      return show(ctx, `Заказ №${order.id} отменён${order.cancelReason === 'GRACE' ? ' без последствий' : ''}.`, kb([btn('Мои', 'my')]));
    });
    case 'omc': return guard(ctx, async () => {
      await deals.proposeMutualCancel(n(a), ctx.user);
      return show(ctx, 'Предложение взаимной отмены отправлено. Пока участник не согласился, заказ действует.', kb([btn('К заказу', `o:${a}`)]));
    });
    case 'ma':
    case 'md': return guard(ctx, async () => {
      const order = await deals.answerMutualCancel(n(a), ctx.user, key === 'ma');
      return show(ctx, key === 'ma' ? `Заказ №${order.id} отменён по взаимному согласию.` : 'Вы отказались от отмены — заказ остаётся в силе.', key === 'ma' ? kb([btn('Мои', 'my')]) : orderKb(order));
    });
    case 'och': return changeMenu(ctx, n(a));
    case 'chf': return changeField(ctx, n(a), b);
    case 'chp': return proposeChange(ctx, n(a), 'time', b);
    case 'chl': return proposeChange(ctx, n(a), 'place', b);
    case 'ca':
    case 'cd': return guard(ctx, async () => {
      const order = await deals.answerChange(n(a), ctx.user, key === 'ca');
      return show(ctx, key === 'ca' ? `Изменения приняты.\n\n${orderBody(order)}` : 'Изменения отклонены, действуют прежние условия.', orderKb(order));
    });
    case 'rv': return pickRating(ctx, n(a), n(b));
    case 'rvs': return submitRating(ctx, n(a));
    case 'rs': await setState(ctx, null, { review: null }); return show(ctx, 'Хорошо, без оценки.', kb([btn('Мои', 'my')]));
    default: return null;
  }
}

async function onText(ctx, text, msg) {
  const screen = ctx.state.screen;
  if (screen === 'chat') return onChatMessage(ctx, msg);
  if (screen === 'problem_text') return problemSend(ctx, ctx.state.data.problemOrderId, 'other', text.slice(0, 500));
  if (screen === 'review_comment') return submitRating(ctx, ctx.state.data.review?.orderId, text.slice(0, 500));
  if (screen === 'change_value') {
    const { orderId, field } = ctx.state.data.change || {};
    if (field === 'time') {
      const range = parseRange(text);
      if (!range) return send(ctx.chatId, 'Формат: 10:00-11:30.');
      return proposeChange(ctx, orderId, 'time', range);
    }
    return proposeChange(ctx, orderId, field, text.trim());
  }
  return null;
}

const SCREENS = ['chat', 'problem_text', 'review_comment', 'change_value'];
const KEYS = ['fe', 'fx', 'fi', 'fo', 'fc', 'fr', 'vo', 'ia', 'id', 'ic', 'ip', 'my', 'oe', 'oxo', 'ocopy', 'sx', 'o', 'oc', 'od', 'ot', 'ocn', 'ocs', 'ok', 'op', 'pt', 'om', 'ox', 'oxy', 'omc', 'ma', 'md', 'och', 'chf', 'chp', 'chl', 'ca', 'cd', 'rv', 'rvs', 'rs'];

module.exports = {
  onCallback,
  onText,
  onChatMessage,
  executorFeed,
  orderFeed,
  myMenu,
  notifyExecutorsAboutOrder,
  notifyCustomersAboutSlots,
  SCREENS,
  KEYS,
};

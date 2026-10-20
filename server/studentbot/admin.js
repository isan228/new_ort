const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  SbUser, SbOrder, SbSlot, SbInvitation, SbReport, SbMessage, SbModeration, SbPayment, SbReferral, SbCompletion,
} = require('./models');
const { isAdmin, setState, loadConfig } = require('./ctx');
const { saveConfig } = require('./config');
const {
  accessStatus, applyPurchase, adminAdjust, refundPayment,
} = require('./access');
const { invalidateForOrder, notifyInvalidated } = require('./deals');
const {
  DAY, HOUR, humanDateTime, localToUtc, parseRange,
} = require('./time');
const {
  esc, btn, kb, show, send, orderBody, orderWhen, ratingsFor, ratingText, SEX,
} = require('./ui');

const back = (data = 'ad:home') => [btn('Назад', data)];

async function journal(ctx, entry) {
  await SbModeration.create({ adminTgId: ctx.from.id, ...entry });
}

async function home(ctx) {
  await setState(ctx, null);
  return show(ctx, '🛠 Панель управления Student Bot.', kb(
    [btn('Пользователи', 'ad:users'), btn('Заказы', 'ad:orders')],
    [btn('Обращения', 'ad:reps'), btn('Доступ и тарифы', 'ad:acc')],
    [btn('Статистика', 'ad:stats'), btn('Настройки', 'ad:set')],
  ));
}

async function ask(ctx, prompt, action, payload = {}, backTo = 'ad:home') {
  await setState(ctx, 'ad_input', { adm: { action, ...payload } });
  return show(ctx, prompt, kb(back(backTo)));
}

// ---------- Users ----------

async function findUsers(query) {
  const q = query.trim().replace(/^@/, '');
  const where = /^\d+$/.test(q)
    ? { [Op.or]: [{ tgId: q }, { id: Number(q) }] }
    : { [Op.or]: [{ nickname: { [Op.iLike]: `%${q}%` } }, { username: { [Op.iLike]: `%${q}%` } }] };
  return SbUser.findAll({ where, limit: 10, order: [['id', 'DESC']] });
}

async function userCard(ctx, id) {
  const u = await SbUser.findByPk(id);
  if (!u) return show(ctx, 'Пользователь не найден.', kb(back('ad:users')));
  const cfg = await loadConfig();
  const st = accessStatus(u, cfg);
  const week = new Date(Date.now() - 7 * DAY);
  const [active, cancels, lates, invited, granted] = await Promise.all([
    SbOrder.count({ where: { status: ['OPEN', 'ACCEPTED'], [Op.or]: [{ creatorId: u.id }, { executorId: u.id }] } }),
    SbOrder.count({ where: { cancelledById: u.id, cancelReason: ['UNILATERAL', 'LATE'], cancelledAt: { [Op.gt]: week } } }),
    SbOrder.count({ where: { cancelledById: u.id, cancelReason: 'LATE', cancelledAt: { [Op.gt]: week } } }),
    SbReferral.count({ where: { referrerId: u.id } }),
    SbReferral.count({ where: { referrerId: u.id, referrerBonus: 'granted' } }),
  ]);
  const r = (await ratingsFor([u.id])).get(u.id);
  let restriction = 'нет';
  if (u.needsReview) restriction = `до решения администратора (${esc(u.blockReason || '')})`;
  else if (u.blockedUntil && new Date(u.blockedUntil) > new Date()) restriction = `до ${humanDateTime(u.blockedUntil)} (${esc(u.blockReason || '')})`;
  return show(ctx, [
    `<b>#${u.id}</b> · tg ${u.tgId} · @${esc(u.username || '—')}`,
    `${esc(u.nickname || '—')} · ${esc(u.faculty || '—')}, ${u.course || '—'} курс · ${SEX[u.sex] || '—'}`,
    `Зарегистрирован: ${u.registered ? humanDateTime(u.consentAt) : 'нет'}`,
    `Ограничение: ${restriction}`,
    `Активных договорённостей: ${active}`,
    `Отмен за 7 дней: ${cancels} (поздних ${lates})`,
    `Рейтинг: заказчик ${ratingText(r.customer)} · исполнитель ${ratingText(r.executor)} · выполнено ${r.done}`,
    `Рефералы: приглашено ${invited}, начислено ${granted}`,
    `Доступ: ${st.kind}${st.until ? ` до ${humanDateTime(st.until)}` : ''} · оплат ${u.paidCount} · аванс ${u.advanceAvailable ? 'доступен' : 'нет'}${u.advanceDebt ? ` · долг ${u.advanceDebt} дн.` : ''}`,
  ].join('\n'), kb(
    [btn('Ограничить', `ad:ub:${u.id}`), btn('Снять ограничение', `ad:uu:${u.id}`)],
    [btn('Посмотреть историю', `ad:uh:${u.id}`), btn('Изменить доступ', `ad:ua:${u.id}`)],
    back('ad:users'),
  ));
}

async function userHistory(ctx, id) {
  const [orders, actions] = await Promise.all([
    SbOrder.findAll({ where: { [Op.or]: [{ creatorId: id }, { executorId: id }] }, order: [['id', 'DESC']], limit: 10 }),
    SbModeration.findAll({ where: { subjectId: id }, order: [['id', 'DESC']], limit: 8 }),
  ]);
  const o = orders.map((x) => `№${x.id} · ${x.status}${x.cancelReason ? `/${x.cancelReason}` : ''} · ${orderWhen(x)} · ${x.creatorId === id ? 'заказчик' : 'исполнитель'}`);
  const a = actions.map((x) => `${humanDateTime(x.createdAt)} · ${x.action} · ${esc(x.reason || '')}`);
  return show(ctx, `<b>Заказы</b>\n${o.map(esc).join('\n') || '—'}\n\n<b>Модерация</b>\n${a.join('\n') || '—'}`, kb(...orders.slice(0, 5).map((x) => [btn(`Заказ №${x.id}`, `ad:o:${x.id}`)]), back(`ad:u:${id}`)));
}

// ---------- Orders ----------

async function orderList(ctx, status) {
  const orders = await SbOrder.findAll({ where: { status }, order: [['id', 'DESC']], limit: 10 });
  return show(ctx, `<b>Заказы: ${status}</b>\n\n${orders.map((o) => esc(`№${o.id} · ${orderWhen(o)} · ${o.placeText}`)).join('\n') || '—'}`, kb(
    ...orders.map((o) => [btn(`№${o.id}`, `ad:o:${o.id}`)]),
    back('ad:orders'),
  ));
}

async function orderCard(ctx, id) {
  const o = await SbOrder.findByPk(id);
  if (!o) return show(ctx, 'Заказ не найден.', kb(back('ad:orders')));
  const [creator, executor, invs, done] = await Promise.all([
    SbUser.findByPk(o.creatorId),
    o.executorId ? SbUser.findByPk(o.executorId) : null,
    SbInvitation.count({ where: { orderId: o.id } }),
    SbCompletion.findAll({ where: { orderId: o.id } }),
  ]);
  return show(ctx, [
    `<b>Заказ №${o.id}</b> · ${o.status}${o.cancelReason ? ` (${o.cancelReason})` : ''}`,
    `Заказчик: #${creator.id} ${esc(creator.nickname)}`,
    `Исполнитель: ${executor ? `#${executor.id} ${esc(executor.nickname)}` : '—'}`,
    `Создан: ${humanDateTime(o.createdAt)} · принят: ${humanDateTime(o.acceptedAt)} · завершён: ${humanDateTime(o.completedAt)}`,
    `Приглашений: ${invs} · отметок «Выполнено»: ${done.length}/2`,
    o.cancelNote ? `Причина отмены: ${esc(o.cancelNote)}` : null,
    '',
    orderBody(o),
  ].filter((x) => x !== null).join('\n'), kb(
    ['OPEN', 'ACCEPTED'].includes(o.status) ? [btn('Отменить заказ', `ad:oc:${o.id}`)] : null,
    o.status === 'ACCEPTED' ? [btn('Закрыть как выполненный', `ad:od:${o.id}`)] : null,
    [btn('Заказчик', `ad:u:${creator.id}`), executor ? btn('Исполнитель', `ad:u:${executor.id}`) : null].filter(Boolean),
    back('ad:orders'),
  ));
}

async function adminCancelOrder(ctx, id, reason) {
  const res = await sequelize.transaction(async (transaction) => {
    const o = await SbOrder.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!o || !['OPEN', 'ACCEPTED'].includes(o.status)) return null;
    const before = { status: o.status };
    await o.update({ status: 'CANCELLED', cancelReason: 'ADMIN', cancelledAt: new Date(), cancelNote: reason }, { transaction });
    if (o.slotId) {
      const slot = await SbSlot.findByPk(o.slotId, { transaction });
      if (slot?.state === 'BOOKED') await slot.update({ state: new Date(slot.endsAt) > new Date() ? 'OPEN' : 'EXPIRED' }, { transaction });
    }
    const inv = await invalidateForOrder(o.id, 'заказ отменён администратором', transaction);
    return { o, before, inv };
  });
  if (!res) return show(ctx, 'Заказ уже закрыт.', kb(back(`ad:o:${id}`)));
  await journal(ctx, { orderId: id, action: 'cancel_order', reason, before: res.before, after: { status: 'CANCELLED' } });
  await notifyInvalidated(res.inv);
  for (const uid of [res.o.creatorId, res.o.executorId].filter(Boolean)) {
    const u = await SbUser.findByPk(uid);
    await send(u.tgId, `Заказ №${id} отменён администратором. Причина: ${esc(reason)}`);
  }
  return orderCard(ctx, id);
}

async function adminCompleteOrder(ctx, id, reason) {
  const o = await SbOrder.findByPk(id);
  if (!o || o.status !== 'ACCEPTED') return show(ctx, 'Заказ не в работе.', kb(back(`ad:o:${id}`)));
  await o.update({ status: 'COMPLETED', completedAt: new Date() });
  await journal(ctx, { orderId: id, action: 'complete_order', reason, before: { status: 'ACCEPTED' }, after: { status: 'COMPLETED' } });
  for (const uid of [o.creatorId, o.executorId]) {
    const u = await SbUser.findByPk(uid);
    await send(u.tgId, `Администратор закрыл заказ №${id} как выполненный. Причина: ${esc(reason)}\nОцените участника:`, kb([1, 2, 3, 4, 5].map((n) => btn(`⭐${n}`, `rv:${id}:${n}`)), [btn('Пропустить', `rs:${id}`)]));
  }
  return orderCard(ctx, id);
}

// ---------- Reports ----------

async function reportList(ctx) {
  const reps = await SbReport.findAll({ where: { status: ['OPEN', 'WAITING'] }, order: [['id', 'ASC']], limit: 15 });
  return show(ctx, `<b>Очередь обращений</b>: ${reps.length}\n\n${reps.map((r) => esc(`№${r.id} · ${r.category} · ${r.status} · ${r.message.slice(0, 50)}`)).join('\n') || 'Пусто'}`, kb(
    ...reps.map((r) => [btn(`№${r.id} · ${r.category}`, `ad:rep:${r.id}`)]),
    back(),
  ));
}

async function reportCard(ctx, id) {
  const r = await SbReport.findByPk(id);
  if (!r) return show(ctx, 'Обращение не найдено.', kb(back('ad:reps')));
  const [reporter, subject] = await Promise.all([SbUser.findByPk(r.reporterId), r.subjectId ? SbUser.findByPk(r.subjectId) : null]);
  return show(ctx, [
    `<b>Обращение №${r.id}</b> · ${r.category} · ${r.status}`,
    `От: #${reporter.id} ${esc(reporter.nickname)}`,
    subject ? `О ком: #${subject.id} ${esc(subject.nickname)}` : null,
    r.orderId ? `Заказ: №${r.orderId}` : null,
    `Создано: ${humanDateTime(r.createdAt)}`,
    '',
    esc(r.message),
    r.resolution ? `\nРешение: ${esc(r.resolution)}` : null,
  ].filter((x) => x !== null).join('\n'), kb(
    [btn('Запросить пояснение', `ad:rq:${r.id}`), btn('Закрыть обращение', `ad:rc:${r.id}`)],
    r.orderId ? [btn('Заказ', `ad:o:${r.orderId}`), btn('Переписка по заказу', `ad:rm:${r.id}`)] : null,
    r.orderId ? [btn('Отменить заказ', `ad:oc:${r.orderId}`)] : null,
    [subject ? btn('Пересмотреть блокировку', `ad:uu:${subject.id}`) : null, btn('Автор', `ad:u:${reporter.id}`)].filter(Boolean),
    back('ad:reps'),
  ));
}

// Chat content is opened only through a specific report, and every view is journaled.
async function reportMessages(ctx, id) {
  const r = await SbReport.findByPk(id);
  if (!r?.orderId) return reportCard(ctx, id);
  const msgs = await SbMessage.findAll({ where: { orderId: r.orderId }, order: [['id', 'ASC']], limit: 40 });
  await journal(ctx, { reportId: r.id, orderId: r.orderId, action: 'view_messages', reason: `Обращение №${r.id}` });
  const users = new Map((await SbUser.findAll({ where: { id: [...new Set(msgs.map((m) => m.fromId))] } })).map((u) => [u.id, u]));
  const lines = msgs.map((m) => `${humanDateTime(m.createdAt)} · ${esc(users.get(m.fromId)?.nickname || '—')}: ${m.purged ? '[удалено по сроку хранения]' : esc(m.text || `[${m.type}]`)}`);
  return show(ctx, `<b>Переписка по заказу №${r.orderId}</b>\n\n${lines.join('\n') || 'Сообщений нет'}`.slice(0, 4000), kb(back(`ad:rep:${r.id}`)));
}

// ---------- Access, tariffs, stats, settings ----------

async function accessScreen(ctx) {
  const cfg = await loadConfig();
  return show(ctx, [
    '<b>Доступ и тарифы</b>',
    `LAUNCH_AT: ${cfg.launchAt ? humanDateTime(cfg.launchAt) : 'не задан'} (+${cfg.promoHours} ч бесплатно для всех)`,
    `Тарифы: ${cfg.tariffs.map((t) => `${t.days} дн. — ${t.price || 'цена не задана'}`).join('; ')}`,
    `Платёжная интеграция: ${cfg.paymentsEnabled ? 'включена' : 'не подключена — доступ выдаётся вручную (Пользователь → Изменить доступ)'}`,
  ].join('\n'), kb(
    [btn('Задать LAUNCH_AT', 'ad:launch'), btn('Цены тарифов', 'ad:prices')],
    [btn('Реферальная аналитика', 'ad:refstats')],
    back(),
  ));
}

async function stats(ctx) {
  const now = Date.now();
  const week = new Date(now - 7 * DAY);
  const [users, users7, orders, byStatus, invs, accepted, reports, payments, refs] = await Promise.all([
    SbUser.count({ where: { registered: true } }),
    SbUser.count({ where: { registered: true, consentAt: { [Op.gt]: week } } }),
    SbOrder.count(),
    SbOrder.findAll({ attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']], group: ['status'], raw: true }),
    SbInvitation.count(),
    SbOrder.findAll({ where: { acceptedAt: { [Op.ne]: null } }, attributes: ['createdAt', 'acceptedAt'] }),
    SbReport.count({ where: { status: ['OPEN', 'WAITING'] } }),
    SbPayment.count({ where: { status: 'paid' } }),
    SbReferral.count({ where: { state: 'granted' } }),
  ]);
  const active7 = await SbUser.count({
    where: {
      [Op.or]: [
        { id: (await SbOrder.findAll({ where: { createdAt: { [Op.gt]: week } }, attributes: ['creatorId'] })).map((o) => o.creatorId) },
        { id: (await SbSlot.findAll({ where: { createdAt: { [Op.gt]: week } }, attributes: ['userId'] })).map((s) => s.userId) },
      ],
    },
  });
  const waits = accepted.map((o) => (new Date(o.acceptedAt) - new Date(o.createdAt)) / 60000).sort((a, b) => a - b);
  const median = waits.length ? Math.round(waits[Math.floor(waits.length / 2)]) : null;
  const s = Object.fromEntries(byStatus.map((x) => [x.status, Number(x.n)]));
  const paidUsers = await SbUser.count({ where: { paidCount: { [Op.gt]: 0 } } });
  return show(ctx, [
    '<b>Статистика</b>',
    `Регистрации: ${users} (за 7 дней ${users7}) · активных за 7 дней: ${active7}`,
    `Заявки: ${orders} · OPEN ${s.OPEN || 0} · ACCEPTED ${s.ACCEPTED || 0} · COMPLETED ${s.COMPLETED || 0} · CANCELLED ${s.CANCELLED || 0}`,
    `Приглашений/откликов: ${invs} · медиана до подтверждения: ${median == null ? '—' : `${median} мин`}`,
    `Доля подтверждённых: ${orders ? Math.round((accepted.length / orders) * 100) : 0}% · завершённых: ${orders ? Math.round(((s.COMPLETED || 0) / orders) * 100) : 0}%`,
    `Открытых обращений: ${reports}`,
    `Оплат: ${payments} · конверсия в оплату: ${users ? Math.round((paidUsers / users) * 100) : 0}% · рефералов начислено: ${refs}`,
  ].join('\n'), kb(back()));
}

async function settingsScreen(ctx) {
  const cfg = await loadConfig();
  return show(ctx, [
    '<b>Настройки</b>',
    `Факультеты: ${cfg.faculties.map(esc).join(', ')}`,
    `Места: ${cfg.places.map((p) => `${esc(p.name)} (${p.kind})`).join(', ')}`,
    `Пары: ${Object.entries(cfg.pairs).map(([n, r]) => `${n}: ${r.join('–')}`).join('; ')}`,
  ].join('\n'), kb(
    [btn('Факультеты', 'ad:sf'), btn('Места', 'ad:sp')],
    [btn('Время пар', 'ad:spairs'), btn('Правила', 'ad:srules')],
    back(),
  ));
}

function placeKey(name) {
  return name.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `p${Date.now()}`;
}

// ---------- Text input for admin actions ----------

async function onInput(ctx, text) {
  const adm = ctx.state.data.adm || {};
  const value = text.trim();
  const needReason = (fn) => (value.length < 3 ? send(ctx.chatId, 'Укажите причину (минимум 3 символа).') : fn());
  switch (adm.action) {
    case 'search': {
      const found = await findUsers(value);
      await setState(ctx, null);
      return send(ctx.chatId, found.length ? 'Найдено:' : 'Никого не нашлось.', kb(...found.map((u) => [btn(`#${u.id} ${u.nickname || '—'} @${u.username || '—'}`, `ad:u:${u.id}`)]), back('ad:users')));
    }
    case 'block': return needReason(async () => {
      const u = await SbUser.findByPk(adm.id);
      const before = { blockedUntil: u.blockedUntil, needsReview: u.needsReview };
      const after = adm.hours === 'review'
        ? { needsReview: true, blockReason: value }
        : { blockedUntil: new Date(Date.now() + Number(adm.hours) * HOUR), blockReason: value };
      await u.update(after);
      await journal(ctx, { subjectId: u.id, action: 'restrict', reason: value, before, after });
      await send(u.tgId, `⛔ Администратор ограничил новые сделки: ${esc(value)}. ${after.needsReview ? 'До решения администратора.' : `До ${humanDateTime(after.blockedUntil)}.`} Действующие заказы доступны.`, kb([btn('Оспорить', 'appeal')]));
      await setState(ctx, null);
      return userCard({ ...ctx, messageId: null }, u.id);
    });
    case 'unblock': return needReason(async () => {
      const u = await SbUser.findByPk(adm.id);
      const before = { blockedUntil: u.blockedUntil, needsReview: u.needsReview };
      await u.update({ blockedUntil: null, needsReview: false, blockReason: null });
      await journal(ctx, { subjectId: u.id, action: 'unrestrict', reason: value, before, after: { blockedUntil: null, needsReview: false } });
      await send(u.tgId, `✅ Ограничение снято: ${esc(value)}.`);
      await setState(ctx, null);
      return userCard({ ...ctx, messageId: null }, u.id);
    });
    case 'pay': return needReason(async () => {
      const res = await applyPurchase(adm.id, adm.days, { provider: 'manual', note: value });
      await journal(ctx, { subjectId: adm.id, action: 'manual_purchase', reason: value, after: { days: adm.days, net: res.net, accessEnd: res.user.accessEnd } });
      await send(res.user.tgId, `✅ Доступ продлён на ${res.net} дн.${res.debt ? ` (${res.debt} дн. вычтено за использованный аванс)` : ''} — до ${humanDateTime(res.user.accessEnd)}.`);
      for (const g of res.referrals) {
        for (const [u, state] of [[g.referrer, g.referrerBonus], [g.invitee, g.inviteeBonus]]) {
          await send(u.tgId, state === 'granted' ? '🎁 Реферальный бонус: +3 дня доступа.' : 'Реферальный бонус не начислен: исчерпан лимит 30 дней за 30 суток.');
        }
      }
      await setState(ctx, null);
      return userCard({ ...ctx, messageId: null }, adm.id);
    });
    case 'adjust': {
      const m = value.match(/^(-?\d+)\s+(.{3,})$/);
      if (!m) return send(ctx.chatId, 'Формат: число дней и причина, например «3 компенсация» или «-2 ошибка».');
      const u = await adminAdjust(adm.id, Number(m[1]), m[2]);
      await journal(ctx, { subjectId: adm.id, action: 'adjust_access', reason: m[2], after: { days: Number(m[1]), accessEnd: u.accessEnd } });
      await send(u.tgId, `Доступ скорректирован администратором: ${Number(m[1]) > 0 ? '+' : ''}${m[1]} дн. Причина: ${esc(m[2])}`);
      await setState(ctx, null);
      return userCard({ ...ctx, messageId: null }, adm.id);
    }
    case 'refund': return needReason(async () => {
      const last = await SbPayment.findOne({ where: { userId: adm.id, status: 'paid' }, order: [['id', 'DESC']] });
      const res = last && await refundPayment(last.id, value);
      await setState(ctx, null);
      if (!res) return send(ctx.chatId, 'Оплат для возврата нет.', kb(back(`ad:u:${adm.id}`)));
      await journal(ctx, { subjectId: adm.id, action: 'refund', reason: value, after: { paymentId: last.id, days: last.days } });
      return userCard({ ...ctx, messageId: null }, adm.id);
    });
    case 'cancelOrder': return needReason(async () => { await setState(ctx, null); return adminCancelOrder({ ...ctx, messageId: null }, adm.id, value); });
    case 'completeOrder': return needReason(async () => { await setState(ctx, null); return adminCompleteOrder({ ...ctx, messageId: null }, adm.id, value); });
    case 'askReport': return needReason(async () => {
      const r = await SbReport.findByPk(adm.id);
      const u = await SbUser.findByPk(r.reporterId);
      await r.update({ status: 'WAITING' });
      await journal(ctx, { reportId: r.id, action: 'ask_report', reason: value });
      await send(u.tgId, `По обращению №${r.id} администратор просит пояснить: ${esc(value)}\nОтветьте новым обращением в «Профиль → Поддержка».`, kb([btn('Поддержка', 'sup')]));
      await setState(ctx, null);
      return reportCard({ ...ctx, messageId: null }, r.id);
    });
    case 'closeReport': return needReason(async () => {
      const r = await SbReport.findByPk(adm.id);
      await r.update({ status: 'CLOSED', resolution: value, resolvedAt: new Date() });
      await journal(ctx, { reportId: r.id, subjectId: r.subjectId, action: 'close_report', reason: value });
      const u = await SbUser.findByPk(r.reporterId);
      await send(u.tgId, `Обращение №${r.id} закрыто. Решение: ${esc(value)}`);
      await setState(ctx, null);
      return reportCard({ ...ctx, messageId: null }, r.id);
    });
    case 'launch': {
      const m = value.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/);
      if (!m) return send(ctx.chatId, 'Формат: 2026-10-25 09:00 (время Бишкека).');
      const at = localToUtc(m[1], m[2].padStart(5, '0'));
      const cfg = await loadConfig();
      await saveConfig('launchAt', at.toISOString());
      await journal(ctx, { action: 'set_launch', reason: value, before: { launchAt: cfg.launchAt }, after: { launchAt: at } });
      await setState(ctx, null);
      return accessScreen({ ...ctx, messageId: null });
    }
    case 'prices': {
      const cfg = await loadConfig();
      const map = Object.fromEntries(value.split(';').map((p) => p.split('=').map((s) => s.trim())).filter((p) => p.length === 2));
      const tariffs = cfg.tariffs.map((t) => ({ ...t, price: map[String(t.days)] ?? t.price }));
      await saveConfig('tariffs', tariffs);
      await journal(ctx, { action: 'set_prices', reason: value, before: cfg.tariffs, after: tariffs });
      await setState(ctx, null);
      return accessScreen({ ...ctx, messageId: null });
    }
    case 'faculties': {
      const list = value.split('\n').map((s) => s.trim()).filter(Boolean);
      if (!list.length) return send(ctx.chatId, 'Нужен хотя бы один факультет.');
      await saveConfig('faculties', list);
      await journal(ctx, { action: 'set_faculties', after: list });
      await setState(ctx, null);
      return settingsScreen({ ...ctx, messageId: null });
    }
    case 'places': {
      const cfg = await loadConfig();
      const places = value.split('\n').map((line) => line.split('|').map((s) => s.trim())).filter((p) => p[0]).map(([name, kind, syn]) => ({
        key: cfg.places.find((p) => p.name === name)?.key || placeKey(name),
        name,
        kind: kind === 'base' ? 'base' : 'main',
        synonyms: (syn || '').split(',').map((s) => s.trim()).filter(Boolean),
      }));
      if (!places.length) return send(ctx.chatId, 'Нужно хотя бы одно место.');
      await saveConfig('places', places);
      await journal(ctx, { action: 'set_places', after: places });
      await setState(ctx, null);
      return settingsScreen({ ...ctx, messageId: null });
    }
    case 'pairs': {
      const pairs = {};
      for (const line of value.split('\n')) {
        const m = line.trim().match(/^([1-4])\s+(.+)$/);
        const range = m && parseRange(m[2]);
        if (range) pairs[m[1]] = range;
      }
      if (Object.keys(pairs).length !== 4) return send(ctx.chatId, 'Нужны все 4 пары, по строке: «1 08:30-10:00».');
      await saveConfig('pairs', pairs);
      await journal(ctx, { action: 'set_pairs', after: pairs });
      await setState(ctx, null);
      return settingsScreen({ ...ctx, messageId: null });
    }
    case 'rules':
      if (value.length < 20) return send(ctx.chatId, 'Текст правил слишком короткий.');
      await saveConfig('rules', value.slice(0, 2000));
      await journal(ctx, { action: 'set_rules' });
      await setState(ctx, null);
      return settingsScreen({ ...ctx, messageId: null });
    default:
      await setState(ctx, null);
      return home(ctx);
  }
}

async function onCallback(ctx, data) {
  if (!isAdmin(ctx.from.id)) return ctx.answer('Нет доступа', true);
  const [, action, a, b] = data.split(':');
  const id = Number(a);
  switch (action) {
    case 'home': return home(ctx);
    case 'users': return ask(ctx, 'Введите Telegram ID, #id, никнейм или @username.', 'search');
    case 'u': return userCard(ctx, id);
    case 'uh': return userHistory(ctx, id);
    case 'ub': return show(ctx, 'На какой срок ограничить новые сделки?', kb(
      [btn('12 часов', `ad:ubd:${id}:12`), btn('24 часа', `ad:ubd:${id}:24`), btn('7 дней', `ad:ubd:${id}:168`)],
      [btn('До решения администратора', `ad:ubd:${id}:review`)],
      back(`ad:u:${id}`),
    ));
    case 'ubd': return ask(ctx, 'Укажите причину ограничения (обязательно).', 'block', { id, hours: b }, `ad:u:${id}`);
    case 'uu': return ask(ctx, 'Причина снятия ограничения:', 'unblock', { id }, `ad:u:${id}`);
    case 'ua': return show(ctx, 'Изменить доступ пользователя:', kb(
      [btn('Оплата 7 дней', `ad:pay:${id}:7`), btn('Оплата 30 дней', `ad:pay:${id}:30`)],
      [btn('± дни вручную', `ad:adj:${id}`), btn('Возврат последней оплаты', `ad:refund:${id}`)],
      back(`ad:u:${id}`),
    ));
    case 'pay': return ask(ctx, `Отметить оплату ${b} дней. Укажите, как подтверждена оплата (номер чека, способ):`, 'pay', { id, days: Number(b) }, `ad:u:${id}`);
    case 'adj': return ask(ctx, 'Напишите число дней и причину: «3 компенсация» или «-2 ошибка».', 'adjust', { id }, `ad:u:${id}`);
    case 'refund': return ask(ctx, 'Причина возврата последней оплаты:', 'refund', { id }, `ad:u:${id}`);
    case 'orders': return show(ctx, 'Какие заказы показать?', kb(
      [btn('OPEN', 'ad:ol:OPEN'), btn('ACCEPTED', 'ad:ol:ACCEPTED')],
      [btn('COMPLETED', 'ad:ol:COMPLETED'), btn('CANCELLED', 'ad:ol:CANCELLED')],
      back(),
    ));
    case 'ol': return orderList(ctx, a);
    case 'o': return orderCard(ctx, id);
    case 'oc': return ask(ctx, 'Причина отмены заказа (её увидят участники):', 'cancelOrder', { id }, `ad:o:${id}`);
    case 'od': return ask(ctx, 'Почему заказ закрывается как выполненный?', 'completeOrder', { id }, `ad:o:${id}`);
    case 'reps': return reportList(ctx);
    case 'rep': return reportCard(ctx, id);
    case 'rm': return reportMessages(ctx, id);
    case 'rq': return ask(ctx, 'Что спросить у автора обращения?', 'askReport', { id }, `ad:rep:${id}`);
    case 'rc': return ask(ctx, 'Решение по обращению (его увидит автор):', 'closeReport', { id }, `ad:rep:${id}`);
    case 'acc': return accessScreen(ctx);
    case 'launch': return ask(ctx, 'Дата и время старта бесплатного периода, время Бишкека: 2026-10-25 09:00', 'launch', {}, 'ad:acc');
    case 'prices': return ask(ctx, 'Цены через точку с запятой: 7=300 сом; 30=900 сом', 'prices', {}, 'ad:acc');
    case 'refstats': {
      const [total, granted, limit, review] = await Promise.all([
        SbReferral.count(), SbReferral.count({ where: { state: 'granted' } }),
        SbReferral.count({ where: { [Op.or]: [{ referrerBonus: 'limit' }, { inviteeBonus: 'limit' }] } }),
        SbReferral.count({ where: { state: 'review' } }),
      ]);
      return show(ctx, `<b>Рефералы</b>\nВсего связей: ${total}\nНачислено: ${granted}\nУпёрлись в лимит: ${limit}\nНа проверке после возврата: ${review}`, kb(back('ad:acc')));
    }
    case 'stats': return stats(ctx);
    case 'set': return settingsScreen(ctx);
    case 'sf': {
      const cfg = await loadConfig();
      return ask(ctx, `Факультеты по одному в строке. Сейчас:\n${cfg.faculties.map(esc).join('\n')}`, 'faculties', {}, 'ad:set');
    }
    case 'sp': {
      const cfg = await loadConfig();
      return ask(ctx, `Места по одному в строке: «Название | main или base | синонимы через запятую». Сейчас:\n${cfg.places.map((p) => esc(`${p.name} | ${p.kind} | ${(p.synonyms || []).join(', ')}`)).join('\n')}`, 'places', {}, 'ad:set');
    }
    case 'spairs': {
      const cfg = await loadConfig();
      return ask(ctx, `Время пар, по строке: «1 08:30-10:00». Сейчас:\n${Object.entries(cfg.pairs).map(([n, r]) => `${n} ${r.join('-')}`).join('\n')}`, 'pairs', {}, 'ad:set');
    }
    case 'srules': return ask(ctx, 'Новый текст правил:', 'rules', {}, 'ad:set');
    default: return home(ctx);
  }
}

module.exports = { home, onCallback, onInput };

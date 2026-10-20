const { Op } = require('sequelize');
const { SbOrder, SbReport, SbAccessLog } = require('../models');
const {
  setState, getBotUsername, notifyAdmins, loadConfig,
} = require('../ctx');
const { accessStatus, referralStats, REF_BONUS_DAYS, REF_LIMIT_DAYS } = require('../access');
const { humanDateTime, humanDate } = require('../time');
const { NICK_BAD, WA } = require('./registration');
const payments = require('../payments');
const {
  esc, btn, kb, show, send, SEX, ratingsFor, ratingText,
} = require('../ui');

async function profile(ctx) {
  await setState(ctx, null);
  const u = ctx.user;
  const r = (await ratingsFor([u.id])).get(u.id);
  return show(ctx, [
    `<b>${esc(u.nickname)}</b> · ${esc(u.faculty)} · ${u.course} курс · ${SEX[u.sex]}`,
    `Как заказчик: ${ratingText(r.customer)}`,
    `Как исполнитель: ${ratingText(r.executor)}`,
    `Выполнено заказов: ${r.done}`,
    `WhatsApp: ${u.whatsapp ? `${esc(u.whatsapp)} (скрыт от других)` : 'не указан'}`,
  ].join('\n'), kb(
    [btn('Изменить профиль', 'pe'), btn('Мой доступ', 'acc')],
    [btn('Пригласить друга', 'ref'), btn('Поддержка', 'sup')],
    [btn(u.notifyMatches ? '🔔 Уведомления о совпадениях: вкл' : '🔕 Уведомления о совпадениях: выкл', 'notif')],
  ));
}

async function editMenu(ctx) {
  await setState(ctx, null);
  return show(ctx, 'Что изменить? Изменения не меняют условия уже принятых заказов.', kb(
    [btn('Никнейм', 'pe:nick'), btn('Факультет', 'pe:fac'), btn('Курс', 'pe:course')],
    [btn('Пол', 'pe:sex'), btn('WhatsApp', 'pe:wa')],
    [btn('Назад', 'pr')],
  ));
}

async function onEdit(ctx, field) {
  const cfg = await loadConfig();
  switch (field) {
    case 'nick':
      await setState(ctx, 'pe_nick');
      return show(ctx, 'Напишите новый никнейм (до 32 символов).', kb([btn('Назад', 'pe')]));
    case 'fac':
      return show(ctx, 'Выберите факультет.', kb(...cfg.faculties.map((f, i) => [btn(f, `pef:${i}`)]), [btn('Другой', 'pef:other'), btn('Назад', 'pe')]));
    case 'course':
      return show(ctx, 'Выберите курс.', kb([1, 2, 3, 4, 5, 6].map((n) => btn(String(n), `pec:${n}`)), [btn('Назад', 'pe')]));
    case 'sex':
      return show(ctx, 'Укажите пол.', kb([btn('Парень', 'pes:m'), btn('Девушка', 'pes:f')], [btn('Назад', 'pe')]));
    case 'wa':
      await setState(ctx, 'pe_wa');
      return show(ctx, 'Напишите WhatsApp в формате +996XXXXXXXXX.', kb(ctx.user.whatsapp ? [btn('Удалить номер', 'pe:wadel')] : null, [btn('Назад', 'pe')]));
    case 'wadel':
      await ctx.user.update({ whatsapp: null });
      return profile(ctx);
    default:
      return editMenu(ctx);
  }
}

async function access(ctx) {
  const cfg = await loadConfig();
  const st = accessStatus(ctx.user, cfg);
  const label = {
    promo: 'общий бесплатный старт', paid: 'оплачено / бонус', advance: 'авансовые сутки', expired: 'истёк',
  }[st.kind];
  const u = ctx.user;
  const lines = [
    `Статус: <b>${label}</b>`,
    `Доступ до: <b>${st.until ? humanDateTime(st.until) : '—'}</b>`,
  ];
  if (u.advanceAvailable) lines.push('Авансовые сутки: доступны — включатся сами при первой новой сделке после окончания срока.');
  if (u.advanceDebt) lines.push(`Использованный аванс: ${u.advanceDebt} дн. — будет вычтен из следующей оплаты.`);
  lines.push('', 'Вход, действующие заказы, оценки, жалобы и профиль доступны и без подписки.');
  return show(ctx, lines.join('\n'), kb(
    [btn('Тарифы', 'acc:tariffs'), btn('Пригласить друга', 'ref')],
    [btn('История начислений', 'acc:hist'), btn('Назад', 'pr')],
  ));
}

async function tariffs(ctx) {
  const cfg = await loadConfig();
  const online = payments.onlinePayments(cfg);
  const lines = cfg.tariffs.map((t) => `• ${t.days} дней${t.price ? ` — ${esc(t.price)}` : ''}`);
  return show(ctx, `Выберите доступ:\n${lines.join('\n')}\n\nПокупка продлевает остаток доступа, а не обнуляет его.${online
    ? '\nОплата через Finik: QR-код придёт сюда в чат, доступ продлится сразу после оплаты.'
    : '\n\nОплата внутри бота ещё настраивается. Чтобы получить доступ сейчас, напишите в поддержку.'}`, kb(
    cfg.tariffs.map((t) => btn(`${t.days} дней`, `buy:${t.days}`)),
    [btn('Поддержка', 'rc:idea'), btn('Назад', 'acc')],
  ));
}

function invoiceText(checkout) {
  return [
    `💳 К оплате: <b>${checkout.amount} сом</b> · доступ на ${checkout.days} дней.`,
    '',
    '1. Нажмите «Оплатить» или отсканируйте QR-код ниже в приложении банка (Mbank, O!Деньги, Optima и др.: «Сканировать QR» → из галереи).',
    '2. После оплаты доступ продлится автоматически — я пришлю сообщение.',
  ].join('\n');
}

async function buy(ctx, days) {
  const cfg = await loadConfig();
  if (!payments.onlinePayments(cfg)) {
    return show(ctx, `Оплата ${days} дней пока недоступна внутри бота. Напишите администратору через «Поддержку» — он активирует доступ после оплаты.`, kb([btn('Поддержка', 'rc:idea'), btn('Назад', 'acc:tariffs')]));
  }
  await ctx.answer('Готовлю оплату…');
  let checkout;
  try {
    checkout = await payments.startCheckout(ctx.user, days);
  } catch (err) {
    if (!(err instanceof payments.PayError)) throw err;
    return show(ctx, err.message, kb([btn('Поддержка', 'rc:idea'), btn('Назад', 'acc:tariffs')]));
  }
  await show(ctx, invoiceText(checkout), kb(
    [{ text: '💳 Оплатить', url: checkout.paymentUrl }],
    [btn('Проверить оплату', `pay:${checkout.id}`)],
    [btn('Назад', 'acc:tariffs')],
  ));
  payments.sendQr(checkout, ctx.chatId);
  return null;
}

async function payStatus(ctx, id) {
  const checkout = await payments.checkoutStatus(ctx.user.id, id);
  if (!checkout) return ctx.answer('Оплата не найдена');
  if (checkout.status === 'paid') {
    return show(ctx, `✅ Оплата ${checkout.amount} сом получена. Доступ до ${humanDateTime(ctx.user.accessEnd)}.`, kb([btn('Мой доступ', 'acc')]));
  }
  if (checkout.status === 'failed') {
    return show(ctx, 'Эта оплата не прошла. Создайте новую.', kb([btn('Тарифы', 'acc:tariffs')]));
  }
  if (checkout.status === 'review') {
    return show(ctx, 'Оплата на проверке у администратора — сумма не совпала со счётом. Мы напишем вам.', kb([btn('Поддержка', 'sup')]));
  }
  return ctx.answer('Оплата ещё не поступила. Если вы уже оплатили — подождите минуту и проверьте снова.', true);
}

async function accessHistory(ctx) {
  const rows = await SbAccessLog.findAll({ where: { userId: ctx.user.id }, order: [['id', 'DESC']], limit: 15 });
  const kind = {
    purchase: 'оплата', referral: 'реферальный бонус', advance: 'аванс', admin: 'корректировка', refund: 'возврат',
  };
  const text = rows.length
    ? rows.map((r) => `${humanDateTime(r.createdAt)} · ${kind[r.kind] || r.kind} · ${r.days > 0 ? '+' : ''}${r.days} дн.${r.note ? ` · ${esc(r.note)}` : ''}`).join('\n')
    : 'Начислений пока нет.';
  return show(ctx, `<b>История начислений</b>\n\n${text}`, kb([btn('Назад', 'acc')]));
}

async function referral(ctx, list = false) {
  const stats = await referralStats(ctx.user.id);
  const link = `https://t.me/${await getBotUsername()}?start=r_${ctx.user.refCode}`;
  if (list) {
    const state = (row) => {
      if (row.link.state === 'registered') return 'зарегистрирован, ждём оплату обоих';
      if (row.link.referrerBonus === 'limit') return 'лимит бонусов исчерпан';
      if (row.link.state === 'review') return 'на проверке';
      return `начислено +${REF_BONUS_DAYS} дн.`;
    };
    const text = stats.rows.length ? stats.rows.map((r) => `${esc(r.invitee?.nickname || '—')} · ${state(r)}`).join('\n') : 'Приглашённых пока нет.';
    return show(ctx, `<b>Мои приглашения</b>\n\n${text}`, kb([btn('Назад', 'ref')]));
  }
  return show(ctx, [
    `Пригласи друга: +${REF_BONUS_DAYS} дня вам и +${REF_BONUS_DAYS} дня другу после того, как вы оба оплатите подписку. Не более ${REF_LIMIT_DAYS} бонусных дней за любые 30 суток.`,
    '',
    `Ваша ссылка: ${link}`,
    '',
    `Приглашено: ${stats.invited} · ждут оплату: ${stats.waiting} · начислено: ${stats.granted}`,
    `Бонусных дней за 30 суток: ${stats.bonusDays30} · осталось до лимита: ${stats.left30}`,
  ].join('\n'), kb(
    [{ text: 'Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Помощь с учебными задачами — Student Bot')}` }],
    [btn('Мои приглашения', 'ref:list'), btn('Назад', 'pr')],
  ));
}

async function support(ctx) {
  await setState(ctx, null);
  const mine = await SbReport.findAll({ where: { reporterId: ctx.user.id }, order: [['id', 'DESC']], limit: 5 });
  const status = { OPEN: 'на рассмотрении', WAITING: 'ждёт вашего пояснения', CLOSED: 'закрыто' };
  const lines = mine.map((r) => `№${r.id} · ${status[r.status]}${r.resolution ? ` · ${esc(r.resolution)}` : ''}`);
  return show(ctx, `Выберите тип обращения.${lines.length ? `\n\n<b>Мои обращения</b>\n${lines.join('\n')}` : ''}`, kb(
    [btn('Проблема по заказу', 'rc:order'), btn('Жалоба на участника', 'rc:user')],
    [btn('Предложение / вопрос', 'rc:idea'), btn('Назад', 'pr')],
  ));
}

async function startReport(ctx, category, { orderId = null, subjectId = null } = {}) {
  if (category === 'order' && !orderId) {
    const id = ctx.user.id;
    const orders = await SbOrder.findAll({ where: { [Op.or]: [{ creatorId: id }, { executorId: id }] }, order: [['id', 'DESC']], limit: 8 });
    if (!orders.length) return show(ctx, 'У вас пока нет заказов. Выберите другой тип обращения.', kb([btn('Назад', 'sup')]));
    return show(ctx, 'По какому заказу обращение?', kb(...orders.map((o) => [btn(`№${o.id} · ${humanDate(o.date)} · ${o.placeText}`.slice(0, 60), `rp:${o.id}`)]), [btn('Назад', 'sup')]));
  }
  if (category === 'user' && !subjectId) {
    return show(ctx, 'Жалобу на участника удобнее отправить из его карточки или из заказа («Проблема» → «Жалоба администратору»). Или опишите ситуацию в обращении по заказу.', kb([btn('Проблема по заказу', 'rc:order'), btn('Назад', 'sup')]));
  }
  if (orderId) {
    const o = await SbOrder.findByPk(orderId);
    const participant = o && [o.creatorId, o.executorId].includes(ctx.user.id);
    // A complaint from a feed card names the person; otherwise only participants can report an order.
    if (!o || (!participant && !subjectId)) return ctx.answer('Заказ не найден');
    if (participant && !subjectId) subjectId = o.creatorId === ctx.user.id ? o.executorId : o.creatorId;
  }
  await setState(ctx, 'report_text', { report: { category, orderId, subjectId } });
  const head = { order: `Обращение по заказу №${orderId}`, user: 'Жалоба на участника', idea: 'Предложение или вопрос', appeal: 'Оспорить ограничение' }[category];
  return show(ctx, `${head}. Опишите ситуацию одним сообщением.`, kb([btn('Отмена', 'sup')]));
}

async function previewReport(ctx, text) {
  await setState(ctx, 'report_ready', { report: { ...ctx.state.data.report, message: text.slice(0, 2000) } });
  return send(ctx.chatId, `Проверьте обращение:\n\n${esc(text.slice(0, 2000))}`, kb([btn('Отправить', 'rsend'), btn('Изменить', 'rfix')]));
}

async function sendReport(ctx) {
  const r = ctx.state.data.report;
  if (!r?.message) return support(ctx);
  const report = await SbReport.create({
    orderId: r.orderId || null, reporterId: ctx.user.id, subjectId: r.subjectId || null, category: r.category, message: r.message,
  });
  await setState(ctx, null, { report: null });
  await notifyAdmins(`📥 Новое обращение №${report.id} (${r.category}) от ${esc(ctx.user.nickname)}${r.orderId ? ` · заказ №${r.orderId}` : ''}:\n${esc(r.message)}`, kb([btn('Открыть', `ad:rep:${report.id}`)]));
  return show(ctx, `Обращение №${report.id} зарегистрировано. Статус — в «Профиль → Поддержка».`, kb([btn('Поддержка', 'sup')]));
}

async function onCallback(ctx, data) {
  const [key, a, b] = data.split(':');
  switch (key) {
    case 'pr': return profile(ctx);
    case 'pe': return a ? onEdit(ctx, a) : editMenu(ctx);
    case 'pef': {
      const cfg = await loadConfig();
      if (a === 'other') {
        await setState(ctx, 'pe_fac');
        return show(ctx, 'Напишите название факультета.', kb([btn('Назад', 'pe')]));
      }
      await ctx.user.update({ faculty: cfg.faculties[Number(a)] });
      return profile(ctx);
    }
    case 'pec': await ctx.user.update({ course: Number(a) }); return profile(ctx);
    case 'pes': await ctx.user.update({ sex: a === 'f' ? 'f' : 'm' }); return profile(ctx);
    case 'notif': await ctx.user.update({ notifyMatches: !ctx.user.notifyMatches }); return profile(ctx);
    case 'acc':
      if (a === 'tariffs') return tariffs(ctx);
      if (a === 'hist') return accessHistory(ctx);
      return access(ctx);
    case 'buy': return buy(ctx, Number(a));
    case 'pay': return payStatus(ctx, Number(a));
    case 'ref': return referral(ctx, a === 'list');
    case 'sup': return support(ctx);
    case 'rc': return startReport(ctx, a);
    case 'rp': return startReport(ctx, 'order', { orderId: Number(a) });
    case 'ru': return startReport(ctx, 'user', { subjectId: Number(a), orderId: Number(b) || null });
    case 'appeal': return startReport(ctx, 'appeal');
    case 'rsend': return sendReport(ctx);
    case 'rfix': await setState(ctx, 'report_text'); return show(ctx, 'Опишите ситуацию заново одним сообщением.', kb([btn('Отмена', 'sup')]));
    default: return null;
  }
}

async function onText(ctx, text) {
  const value = text.trim();
  switch (ctx.state.screen) {
    case 'pe_nick':
      if (!value || value.length > 32 || NICK_BAD.test(value)) return send(ctx.chatId, 'Никнейм: от 1 до 32 символов, без ссылок, @ и телефонов.');
      await ctx.user.update({ nickname: value });
      return profile(ctx);
    case 'pe_fac':
      if (value.length < 2) return send(ctx.chatId, 'Напишите название факультета.');
      await ctx.user.update({ faculty: value.slice(0, 120) });
      return profile(ctx);
    case 'pe_wa': {
      const phone = value.replace(/[\s()-]/g, '');
      if (!WA.test(phone)) return send(ctx.chatId, 'Формат: +996XXXXXXXXX.');
      await ctx.user.update({ whatsapp: phone });
      return profile(ctx);
    }
    case 'report_text':
      if (value.length < 5) return send(ctx.chatId, 'Опишите чуть подробнее.');
      return previewReport(ctx, value);
    default: return null;
  }
}

const SCREENS = ['pe_nick', 'pe_fac', 'pe_wa', 'report_text'];
const KEYS = ['pr', 'pe', 'pef', 'pec', 'pes', 'notif', 'acc', 'buy', 'pay', 'ref', 'sup', 'rc', 'rp', 'ru', 'appeal', 'rsend', 'rfix'];

module.exports = {
  onCallback, onText, profile, SCREENS, KEYS,
};

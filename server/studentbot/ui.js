const { Op } = require('sequelize');
const { tg, escapeHtml } = require('../utils/telegram');
const { SbUser, SbReview, SbOrder } = require('./models');
const { humanDate, pairLabel } = require('./time');

const esc = escapeHtml;
const SEX = { m: 'Парень', f: 'Девушка', any: 'Не важно' };
const FACULTY_MODE = { mine: 'мой факультет', any: 'любой факультет', specific: 'конкретный факультет' };

const MENU = {
  keyboard: [
    [{ text: 'Не могу присутствовать' }, { text: 'Могу присутствовать' }],
    [{ text: 'Мои' }, { text: 'Профиль' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const btn = (text, data) => ({ text, callback_data: data });
const kb = (...rows) => ({ inline_keyboard: rows.filter((r) => r && r.length) });

async function deliver(tgId, payload) {
  try {
    return await tg('sendMessage', { chat_id: tgId, parse_mode: 'HTML', disable_web_page_preview: true, ...payload });
  } catch (err) {
    // The deal stays valid; "Мои" always shows the real state even if a notice did not arrive.
    if (err.code === 403) await SbUser.update({ chatUnreachable: true }, { where: { tgId } });
    console.warn('studentbot send:', err.message);
    return null;
  }
}

function send(tgId, text, markup) {
  return deliver(tgId, { text, reply_markup: markup });
}

// Edits the card the user pressed a button on; falls back to a new message when Telegram refuses.
async function show(ctx, text, markup) {
  if (ctx.messageId) {
    try {
      return await tg('editMessageText', {
        chat_id: ctx.chatId,
        message_id: ctx.messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: markup || { inline_keyboard: [] },
      });
    } catch (err) {
      if (/not modified/i.test(err.message)) return null;
    }
  }
  return send(ctx.chatId, text, markup);
}

async function ratingsFor(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const out = new Map(ids.map((id) => [id, { customer: { sum: 0, n: 0 }, executor: { sum: 0, n: 0 }, done: 0 }]));
  if (!ids.length) return out;
  const reviews = await SbReview.findAll({ where: { toId: ids, revealed: true }, attributes: ['toId', 'role', 'rating'] });
  for (const r of reviews) {
    const row = out.get(r.toId)[r.role];
    row.sum += r.rating;
    row.n += 1;
  }
  const done = await SbOrder.findAll({
    where: { status: 'COMPLETED', [Op.or]: [{ creatorId: ids }, { executorId: ids }] },
    attributes: ['creatorId', 'executorId'],
  });
  for (const o of done) {
    if (out.has(o.creatorId)) out.get(o.creatorId).done += 1;
    if (out.has(o.executorId)) out.get(o.executorId).done += 1;
  }
  return out;
}

function ratingText(row) {
  return row && row.n ? `⭐ ${(row.sum / row.n).toFixed(1)} (${row.n})` : 'Новый пользователь';
}

function ratingValue(row) {
  return row && row.n ? row.sum / row.n : 0;
}

function orderWhen(order) {
  return `${humanDate(order.date)}, ${pairLabel(order.pairType, order.startsAt, order.endsAt)}`;
}

function orderBody(order) {
  const lines = [
    `📅 ${esc(orderWhen(order))}`,
    `📍 ${esc(order.placeText)}`,
    `📚 ${esc(order.subject || 'Без предмета')}`,
    `📝 ${esc(order.description)}`,
    `💰 ${esc(order.compensation)}`,
  ];
  if (order.comment) lines.push(`💬 ${esc(order.comment)}`);
  return lines.join('\n');
}

function orderRequirements(order) {
  const faculty = order.facultyMode === 'specific' ? order.faculty : FACULTY_MODE[order.facultyMode];
  return `Исполнитель: ${SEX[order.requiredSex]} · ${esc(faculty || 'любой факультет')}`;
}

function slotText(slot) {
  const places = (slot.places || []).map((p) => p.text).join(', ');
  return `${humanDate(slot.date)}, ${pairLabel(slot.pairType, slot.startsAt, slot.endsAt)} · ${places}`;
}

function personHead(user) {
  return `<b>${esc(user.nickname)}</b> · ${esc(user.faculty)}, ${user.course} курс`;
}

function orderKb(order) {
  return kb(
    [btn('💬 Переписка', `oc:${order.id}`), btn('📨 Отправить данные', `od:${order.id}`)],
    [btn('✅ Выполнено', `ok:${order.id}`), btn('⚠️ Проблема', `op:${order.id}`)],
    [btn('Ещё…', `om:${order.id}`)],
  );
}

module.exports = {
  orderKb,
  esc,
  SEX,
  FACULTY_MODE,
  MENU,
  btn,
  kb,
  send,
  show,
  deliver,
  ratingsFor,
  ratingText,
  ratingValue,
  orderWhen,
  orderBody,
  orderRequirements,
  slotText,
  personHead,
};

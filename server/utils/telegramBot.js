const { TelegramRequest, TelegramDraft } = require('../models');
const { getSetting, setSetting } = require('../models/AppSetting');
const { tg, escapeHtml } = require('./telegram');

const BTN_NEW = '📅 Найти человека';
const BTN_MINE = '📋 Мои заявки';
const MENU = { keyboard: [[{ text: BTN_NEW }], [{ text: BTN_MINE }]], resize_keyboard: true };
const TZ = 'Asia/Bishkek';
const MEMBER = ['creator', 'administrator', 'member', 'restricted'];

function todayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function humanDate(iso, { short = false } = {}) {
  const d = new Date(`${iso}T00:00:00Z`);
  const opts = short
    ? { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'numeric' }
    : { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' };
  return new Intl.DateTimeFormat('ru-RU', opts).format(d);
}

// "25.10", "25.10.2026", "25/10", "сегодня", "завтра", "послезавтра".
function parseDate(text) {
  const raw = String(text || '').trim().toLowerCase();
  const today = todayIso();
  if (raw === 'сегодня') return today;
  if (raw === 'завтра') return addDays(today, 1);
  if (raw === 'послезавтра') return addDays(today, 2);
  const m = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  if (year < 100) year += 2000;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  // Without a year, a date that already passed means next year.
  if (!m[3] && iso < today) return `${year + 1}${iso.slice(4)}`;
  return iso;
}

function personName(from) {
  return [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || `id${from.id}`;
}

function personLine(name, username) {
  return `${escapeHtml(name)}${username ? ` (@${escapeHtml(username)})` : ''}`;
}

function groupText(req) {
  const lines = [
    `📅 <b>Нужен человек: ${escapeHtml(humanDate(req.date))}</b>`,
    '',
    `📝 ${escapeHtml(req.description)}`,
    '',
    `👤 Заявка от: ${personLine(req.creatorName, req.creatorUsername)}`,
  ];
  if (req.status === 'taken') lines.push('', `✅ <b>Принял(а): ${personLine(req.takerName, req.takerUsername)}</b>`);
  if (req.status === 'cancelled') lines.push('', `❌ <b>Заявка отменена</b>${req.cancelledBy ? ` (${escapeHtml(req.cancelledBy)})` : ''}`);
  return lines.join('\n');
}

const takeKeyboard = (req) => ({ inline_keyboard: [[{ text: '✅ Смогу', callback_data: `t:${req.id}` }]] });

async function groupChatId() {
  return process.env.TELEGRAM_GROUP_ID || getSetting('telegram_group_id');
}

async function safe(promise) {
  try {
    return await promise;
  } catch (err) {
    console.warn('telegram:', err.message);
    return null;
  }
}

async function say(chatId, text, extra = {}) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
}

async function refreshGroupMessage(req) {
  if (!req.groupChatId || !req.groupMessageId) return;
  await safe(tg('editMessageText', {
    chat_id: req.groupChatId,
    message_id: req.groupMessageId,
    text: groupText(req),
    parse_mode: 'HTML',
    reply_markup: req.status === 'open' ? takeKeyboard(req) : { inline_keyboard: [] },
  }));
}

async function isGroupMember(groupId, userId) {
  const member = await safe(tg('getChatMember', { chat_id: groupId, user_id: userId }));
  return !!member && (MEMBER.includes(member.status) && member.is_member !== false);
}

async function setDraft(userId, step, data) {
  const [row] = await TelegramDraft.findOrCreate({ where: { tgUserId: userId }, defaults: { tgUserId: userId, step, data } });
  await row.update({ step, data });
}

async function clearDraft(userId) {
  await TelegramDraft.destroy({ where: { tgUserId: userId } });
}

function dateKeyboard() {
  const today = todayIso();
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  const label = (iso, i) => (i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : humanDate(iso, { short: true }));
  const rows = [];
  for (let i = 0; i < days.length; i += 2) {
    rows.push(days.slice(i, i + 2).map((iso, k) => ({ text: label(iso, i + k), callback_data: `d:${iso}` })));
  }
  rows.push([{ text: '✖️ Отмена', callback_data: 'x' }]);
  return { inline_keyboard: rows };
}

async function startNew(chatId, from) {
  const groupId = await groupChatId();
  if (!groupId) {
    await say(chatId, 'Бот ещё не подключён к группе. Администратор должен написать /bind в группе.');
    return;
  }
  if (!await isGroupMember(groupId, from.id)) {
    await say(chatId, 'Создавать заявки могут только участники группы.');
    return;
  }
  await setDraft(from.id, 'date', {});
  await say(chatId, 'На какую дату нужен человек? Выберите день или напишите дату, например <b>25.10</b>.', { reply_markup: dateKeyboard() });
}

async function askDescription(chatId, userId, date) {
  await setDraft(userId, 'desc', { date });
  await say(chatId, `Дата: <b>${escapeHtml(humanDate(date))}</b>\n\nТеперь опишите, что нужно: время, место, задача.`);
}

async function askConfirm(chatId, userId, data) {
  await setDraft(userId, 'confirm', data);
  await say(chatId, [
    'Проверьте заявку:',
    '',
    `📅 <b>${escapeHtml(humanDate(data.date))}</b>`,
    `📝 ${escapeHtml(data.description)}`,
  ].join('\n'), {
    reply_markup: { inline_keyboard: [[{ text: '✅ Опубликовать', callback_data: 'p' }, { text: '✖️ Отмена', callback_data: 'x' }]] },
  });
}

async function listMine(chatId, from) {
  const rows = await TelegramRequest.findAll({
    where: { creatorTgId: from.id },
    order: [['id', 'DESC']],
    limit: 10,
  });
  if (!rows.length) {
    await say(chatId, 'У вас пока нет заявок.', { reply_markup: MENU });
    return;
  }
  for (const req of rows) {
    let state = '⏳ ищем';
    if (req.status === 'taken') state = `✅ ${personLine(req.takerName, req.takerUsername)}`;
    if (req.status === 'cancelled') state = '❌ отменена';
    await say(chatId, `📅 <b>${escapeHtml(humanDate(req.date))}</b> — ${state}\n${escapeHtml(req.description)}`,
      req.status === 'open' ? { reply_markup: { inline_keyboard: [[{ text: '❌ Отменить заявку', callback_data: `c:${req.id}` }]] } } : {});
  }
}

async function publish(chatId, from, draft) {
  const groupId = await groupChatId();
  if (!groupId) {
    await say(chatId, 'Бот ещё не подключён к группе.');
    return;
  }
  const req = await TelegramRequest.create({
    date: draft.data.date,
    description: draft.data.description,
    status: 'open',
    creatorTgId: from.id,
    creatorName: personName(from),
    creatorUsername: from.username || null,
    groupChatId: groupId,
  });
  const sent = await tg('sendMessage', {
    chat_id: groupId,
    text: groupText(req),
    parse_mode: 'HTML',
    reply_markup: takeKeyboard(req),
  });
  await req.update({ groupMessageId: sent.message_id });
  await clearDraft(from.id);
  await say(chatId, 'Заявка опубликована в группе. Как только кто-то нажмёт «Смогу», я напишу вам.', { reply_markup: MENU });
}

async function takeRequest(query, id) {
  const from = query.from;
  const req = await TelegramRequest.findByPk(id);
  if (!req) return 'Заявка не найдена';
  if (String(req.creatorTgId) === String(from.id)) return 'Это ваша заявка — её возьмёт кто-то другой';
  // Two people can press at the same moment: only the update that still sees "open" wins.
  const [won] = await TelegramRequest.update({
    status: 'taken',
    takerTgId: from.id,
    takerName: personName(from),
    takerUsername: from.username || null,
    takenAt: new Date(),
  }, { where: { id, status: 'open' } });
  if (!won) {
    await req.reload();
    if (req.status === 'cancelled') return 'Заявка отменена';
    return `Уже принял(а): ${req.takerName}`;
  }
  await req.reload();
  await refreshGroupMessage(req);
  await safe(say(req.creatorTgId, `✅ Вашу заявку на <b>${escapeHtml(humanDate(req.date))}</b> принял(а) ${personLine(req.takerName, req.takerUsername)}.\n\n📝 ${escapeHtml(req.description)}`));
  await safe(say(from.id, `Вы приняли заявку на <b>${escapeHtml(humanDate(req.date))}</b>.\n📝 ${escapeHtml(req.description)}\n👤 Автор: ${personLine(req.creatorName, req.creatorUsername)}`));
  return 'Заявка ваша! ✅';
}

async function cancelRequest(req, byName) {
  const [done] = await TelegramRequest.update(
    { status: 'cancelled', cancelledAt: new Date(), cancelledBy: byName },
    { where: { id: req.id, status: 'open' } },
  );
  if (!done) return false;
  await req.reload();
  await refreshGroupMessage(req);
  return true;
}

async function onPrivateMessage(msg) {
  const chatId = msg.chat.id;
  const from = msg.from;
  const text = String(msg.text || '').trim();
  const command = text.split(/\s|@/)[0].toLowerCase();

  if (command === '/start' || command === '/help') {
    await clearDraft(from.id);
    await say(chatId, 'Здравствуйте! Я помогаю найти человека на нужную дату: заявка уходит в группу, и первый, кто нажмёт «Смогу», её получает.\n\nНажмите «📅 Найти человека».', { reply_markup: MENU });
    return;
  }
  if (command === '/new' || text === BTN_NEW) return startNew(chatId, from);
  if (command === '/my' || text === BTN_MINE) return listMine(chatId, from);
  if (command === '/cancel') {
    await clearDraft(from.id);
    await say(chatId, 'Отменено.', { reply_markup: MENU });
    return;
  }

  const draft = await TelegramDraft.findOne({ where: { tgUserId: from.id } });
  if (draft?.step === 'date') {
    const date = parseDate(text);
    if (!date) return say(chatId, 'Не понял дату. Напишите, например, <b>25.10</b> или выберите день кнопкой.', { reply_markup: dateKeyboard() });
    if (date < todayIso()) return say(chatId, 'Эта дата уже прошла. Выберите другую.', { reply_markup: dateKeyboard() });
    return askDescription(chatId, from.id, date);
  }
  if (draft?.step === 'desc') {
    if (text.length < 3) return say(chatId, 'Опишите чуть подробнее: время, место, что нужно сделать.');
    return askConfirm(chatId, from.id, { ...draft.data, description: text.slice(0, 1500) });
  }
  await say(chatId, 'Нажмите «📅 Найти человека», чтобы создать заявку.', { reply_markup: MENU });
}

async function onGroupMessage(msg) {
  const text = String(msg.text || '').trim();
  const command = text.split(/\s|@/)[0].toLowerCase();
  if (command !== '/bind') return;
  const member = await safe(tg('getChatMember', { chat_id: msg.chat.id, user_id: msg.from.id }));
  if (!member || !['creator', 'administrator'].includes(member.status)) {
    await safe(say(msg.chat.id, 'Подключить группу может только её администратор.'));
    return;
  }
  await setSetting('telegram_group_id', String(msg.chat.id));
  await setSetting('telegram_group_title', msg.chat.title || '');
  await safe(say(msg.chat.id, '✅ Группа подключена. Заявки из бота будут приходить сюда.'));
}

async function onCallback(query) {
  const data = String(query.data || '');
  const chatId = query.message?.chat?.id;
  const from = query.from;
  let answer = '';

  if (data.startsWith('t:')) {
    answer = await takeRequest(query, Number(data.slice(2)));
  } else if (data.startsWith('d:')) {
    const date = data.slice(2);
    if (date < todayIso()) answer = 'Эта дата уже прошла';
    else await askDescription(chatId, from.id, date);
  } else if (data === 'p') {
    const draft = await TelegramDraft.findOne({ where: { tgUserId: from.id } });
    if (draft?.step !== 'confirm') answer = 'Заявка уже отправлена или отменена';
    else {
      await safe(tg('editMessageReplyMarkup', { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } }));
      await publish(chatId, from, draft);
    }
  } else if (data === 'x') {
    await clearDraft(from.id);
    await safe(tg('editMessageReplyMarkup', { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } }));
    await say(chatId, 'Отменено.', { reply_markup: MENU });
  } else if (data.startsWith('c:')) {
    const req = await TelegramRequest.findByPk(Number(data.slice(2)));
    if (!req || String(req.creatorTgId) !== String(from.id)) answer = 'Это не ваша заявка';
    else if (await cancelRequest(req, 'автор')) {
      answer = 'Заявка отменена';
      await safe(tg('editMessageReplyMarkup', { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } }));
    } else answer = 'Заявку уже приняли или отменили';
  }

  await safe(tg('answerCallbackQuery', { callback_query_id: query.id, text: answer || undefined, show_alert: !!answer && data.startsWith('t:') }));
}

async function handleUpdate(update) {
  try {
    if (update.callback_query) return await onCallback(update.callback_query);
    const msg = update.message;
    if (!msg?.from || msg.from.is_bot) return null;
    if (msg.chat.type === 'private') return await onPrivateMessage(msg);
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') return await onGroupMessage(msg);
  } catch (err) {
    console.error('telegram update:', err);
  }
  return null;
}

module.exports = { handleUpdate, cancelRequest, groupText, parseDate, humanDate, todayIso };

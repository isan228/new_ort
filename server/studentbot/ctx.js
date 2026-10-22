const crypto = require('crypto');
const { SbUser, SbState } = require('./models');
const { loadConfig } = require('./config');
const { ensureAccess } = require('./access');
const { restricted } = require('./matching');
const { humanDateTime } = require('./time');
const { tg } = require('../utils/telegram');
const {
  esc, btn, kb, show, send,
} = require('./ui');

let botUsername = null;
async function getBotUsername() {
  if (botUsername) return botUsername;
  try {
    botUsername = (await tg('getMe')).username;
  } catch {
    botUsername = 'bot';
  }
  return botUsername;
}

function adminIds() {
  return String(process.env.SB_ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function isAdmin(tgId) {
  return adminIds().includes(String(tgId));
}

async function getState(tgId) {
  const [row] = await SbState.findOrCreate({ where: { tgId }, defaults: { tgId, screen: null, data: {} } });
  return row;
}

async function setState(ctx, screen, patch = {}, { replace = false } = {}) {
  const data = replace ? patch : { ...(ctx.state.data || {}), ...patch };
  await ctx.state.update({ screen, data });
}

async function newRefCode() {
  for (;;) {
    const code = crypto.randomBytes(4).toString('hex');
    if (!await SbUser.count({ where: { refCode: code } })) return code;
  }
}

async function loadUser(from) {
  const [user] = await SbUser.findOrCreate({ where: { tgId: from.id }, defaults: { tgId: from.id, username: from.username || null } });
  // The current @username always comes from Telegram itself, never typed by the user.
  const username = from.username || null;
  if (user.username !== username || user.chatUnreachable) await user.update({ username, chatUnreachable: false });
  return user;
}

const USERNAME_HELP = 'Telegram → Настройки → Изменить профиль → Имя пользователя. Придумайте @username, сохраните и вернитесь сюда.';

function needUsernameScreen(ctx, forNewOffer = false) {
  return show(ctx, forNewOffer
    ? 'Для новых предложений нужен Telegram @username. Установите его в настройках Telegram и нажмите «Проверить». Действующие договорённости можно завершать и без него.'
    : 'Для работы нужен Telegram @username. Установите его в настройках Telegram, затем нажмите «Проверить».',
  kb([btn('Проверить', 'reg:check'), btn('Как установить', 'reg:how')]));
}

// New deals need a registered profile, a @username, no restriction and active access.
async function requireDeal(ctx) {
  const { user } = ctx;
  if (!user.registered) {
    await show(ctx, 'Сначала завершите регистрацию.', kb([btn('Начать', 'reg:start')]));
    return false;
  }
  if (!user.username) {
    await needUsernameScreen(ctx, true);
    return false;
  }
  // Profiles registered while WhatsApp was optional fill it in before their next deal.
  if (!user.whatsapp) {
    await show(ctx, 'Для новых сделок нужен номер WhatsApp. Укажите его — номер увидит только участник подтверждённого заказа и только если вы сами его отправите.',
      kb([btn('Указать WhatsApp', 'pe:wa')]));
    return false;
  }
  if (restricted(user)) {
    await show(ctx, `⛔ Новые сделки временно недоступны: ${esc(user.blockReason || 'ограничение администратора')}. ${user.needsReview ? 'Ограничение до решения администратора.' : `Ограничение до ${humanDateTime(user.blockedUntil)}.`}`,
      kb([btn('Оспорить', 'appeal')], [btn('Мои действующие', 'my:active'), btn('Поддержка', 'sup')]));
    return false;
  }
  const status = await ensureAccess(user);
  if (!status.active) {
    await show(ctx, 'Доступ к новым заявкам и поиску закончился. Действующие договорённости, оценки, жалобы, профиль и приглашения друзей доступны.',
      kb([btn('Оформить подписку', 'acc:tariffs'), btn('Пригласить друга', 'ref')], [btn('Мои активные заказы', 'my:active'), btn('Поддержка', 'sup')]));
    return false;
  }
  return true;
}

async function notifyAdmins(text, markup) {
  for (const id of adminIds()) await send(id, text, markup);
}

module.exports = {
  getBotUsername,
  adminIds,
  isAdmin,
  getState,
  setState,
  newRefCode,
  loadUser,
  USERNAME_HELP,
  needUsernameScreen,
  requireDeal,
  notifyAdmins,
  loadConfig,
};

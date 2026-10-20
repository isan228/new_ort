const { tg } = require('../utils/telegram');
const {
  loadUser, getState, setState, isAdmin,
} = require('./ctx');
const { DealError } = require('./deals');
const { esc, send, MENU } = require('./ui');
const registration = require('./screens/registration');
const order = require('./screens/order');
const slot = require('./screens/slot');
const deal = require('./screens/deal');
const profile = require('./screens/profile');
const admin = require('./admin');
const { startScheduler, stopScheduler, tick } = require('./scheduler');

const MENU_ACTIONS = {
  'Не могу присутствовать': (ctx) => order.startOrder(ctx),
  'Могу присутствовать': (ctx) => slot.startSlots(ctx),
  'Мои': (ctx) => deal.myMenu(ctx),
  'Профиль': (ctx) => profile.profile(ctx),
};

const TEXT_HANDLERS = [
  [registration.SCREENS, registration.onText],
  [order.SCREENS, order.onText],
  [slot.SCREENS, slot.onText],
  [deal.SCREENS, deal.onText],
  [profile.SCREENS, profile.onText],
];

async function onCallback(ctx, data) {
  const key = data.split(':')[0];
  if (key === 'ad') return admin.onCallback(ctx, data);
  if (key === 'reg') return registration.onCallback(ctx, data);
  if (!ctx.user.registered) return registration.onStart(ctx, null);
  if (key === 'of') return order.onCallback(ctx, data);
  if (key === 'sf') return slot.onCallback(ctx, data);
  if (profile.KEYS.includes(key)) return profile.onCallback(ctx, data);
  if (deal.KEYS.includes(key)) return deal.onCallback(ctx, data);
  return ctx.answer('Кнопка устарела');
}

async function onMessage(ctx, msg) {
  const text = typeof msg.text === 'string' ? msg.text : null;
  const command = text?.startsWith('/') ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : null;

  if (command === 'start') return registration.onStart(ctx, text.split(/\s+/)[1] || null);
  if (command === 'admin') {
    if (!isAdmin(ctx.from.id)) return send(ctx.chatId, 'Команда недоступна.');
    return admin.home(ctx);
  }
  if (ctx.state.screen === 'ad_input' && isAdmin(ctx.from.id) && text && !MENU_ACTIONS[text]) return admin.onInput(ctx, text);

  if (!ctx.user.registered) {
    if (text && registration.SCREENS.includes(ctx.state.screen)) return registration.onText(ctx, text);
    return registration.onStart(ctx, null);
  }
  if (command === 'menu' || command === 'cancel') return registration.mainMenu(ctx);

  // Menu buttons always win, so they also close an open order chat.
  if (text && MENU_ACTIONS[text]) {
    await setState(ctx, null);
    return MENU_ACTIONS[text](ctx);
  }
  if (ctx.state.screen === 'chat') return deal.onChatMessage(ctx, msg);
  if (text) {
    for (const [screens, handler] of TEXT_HANDLERS) {
      if (screens.includes(ctx.state.screen)) return handler(ctx, text, msg);
    }
  }
  return send(ctx.chatId, 'Выберите действие в меню ниже.', MENU);
}

// One update per user at a time, so two quick taps cannot interleave on the same dialog state.
const queues = new Map();
function serialize(userKey, job) {
  const prev = queues.get(userKey) || Promise.resolve();
  const next = prev.then(job, job);
  queues.set(userKey, next);
  next.finally(() => {
    if (queues.get(userKey) === next) queues.delete(userKey);
  });
  return next;
}

async function process_(update) {
  const cq = update.callback_query;
  const msg = update.message;
  const chat = cq ? cq.message?.chat : msg?.chat;
  const from = cq ? cq.from : msg?.from;
  if (!from || from.is_bot) return;
  if (!chat || chat.type !== 'private') {
    if (cq) await tg('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
    return;
  }

  let answered = false;
  const answer = async (text, alert = false) => {
    if (!cq) {
      if (text) await send(chat.id, esc(text));
      return;
    }
    if (answered) return;
    answered = true;
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: text || undefined, show_alert: alert }).catch(() => {});
  };

  try {
    const ctx = {
      chatId: chat.id,
      messageId: cq ? cq.message.message_id : null,
      from,
      user: await loadUser(from),
      state: await getState(from.id),
      answer,
    };
    if (cq) await onCallback(ctx, String(cq.data || ''));
    else if (msg) await onMessage(ctx, msg);
  } catch (err) {
    if (err instanceof DealError) await answer(err.message, true);
    else {
      console.error('studentbot:', err);
      await answer('Что-то пошло не так. Попробуйте ещё раз.', true);
    }
  } finally {
    await answer();
  }
}

async function handleUpdate(update) {
  const from = update.callback_query?.from || update.message?.from;
  if (!from) return null;
  return serialize(from.id, () => process_(update));
}

const COMMANDS = [
  { command: 'start', description: 'Главное меню' },
  { command: 'menu', description: 'Показать меню' },
];

module.exports = {
  handleUpdate, startScheduler, stopScheduler, tick, COMMANDS,
};

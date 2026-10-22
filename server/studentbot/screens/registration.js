const { SbUser, SbReferral } = require('../models');
const {
  setState, newRefCode, USERNAME_HELP, needUsernameScreen, loadConfig,
} = require('../ctx');
const {
  esc, btn, kb, show, send, MENU, SEX,
} = require('../ui');

const NICK_BAD = /(https?:\/\/|www\.|t\.me|@|\+?\d[\d\s()-]{6,})/i;
const WA = /^\+996\d{9}$/;

function regData(ctx) {
  return ctx.state.data.reg || {};
}

async function saveReg(ctx, screen, patch) {
  await setState(ctx, screen, { reg: { ...regData(ctx), ...patch } });
}

async function welcome(ctx) {
  return show(ctx, 'Добро пожаловать! Найдите исполнителя для разрешённой студенческой задачи или возьмите заказ.', kb([btn('Начать', 'reg:start')]));
}

async function askNick(ctx) {
  await saveReg(ctx, 'reg_nick', {});
  return show(ctx, 'Придумайте никнейм, который будет виден другим пользователям (до 32 символов, без ссылок и телефонов).',
    kb([btn('Назад', 'reg:start0'), btn('Отмена', 'reg:cancel')]));
}

async function facultyScreen(ctx) {
  const cfg = await loadConfig();
  const r = regData(ctx);
  const mark = (on, text) => (on ? `✅ ${text}` : text);
  await setState(ctx, 'reg_s03');
  const facRows = cfg.faculties.map((f, i) => [btn(mark(r.faculty === f, f), `reg:fac:${i}`)]);
  const other = r.faculty && !cfg.faculties.includes(r.faculty);
  return show(ctx, `Выберите факультет и курс.${r.faculty ? `\nФакультет: <b>${esc(r.faculty)}</b>` : ''}${r.course ? `\nКурс: <b>${r.course}</b>` : ''}`, kb(
    ...facRows,
    [btn(mark(other, other ? `Другой: ${r.faculty}` : 'Другой факультет'), 'reg:fac:other')],
    [1, 2, 3, 4, 5, 6].map((n) => btn(mark(r.course === n, String(n)), `reg:course:${n}`)),
    [btn('Назад', 'reg:back2'), btn('Далее', 'reg:next3')],
  ));
}

async function sexScreen(ctx) {
  const r = regData(ctx);
  await setState(ctx, 'reg_s04');
  const mark = (on, text) => (on ? `✅ ${text}` : text);
  return show(ctx, `Укажите пол и напишите номер WhatsApp в формате +996XXXXXXXXX — он обязателен. Номер увидит только участник подтверждённого заказа и только если вы сами его отправите.${r.whatsapp ? `\nWhatsApp: <b>${esc(r.whatsapp)}</b>` : '\nWhatsApp: <b>не указан</b>'}`, kb(
    [btn(mark(r.sex === 'm', 'Парень'), 'reg:sex:m'), btn(mark(r.sex === 'f', 'Девушка'), 'reg:sex:f')],
    [btn('Назад', 'reg:back3'), btn('Далее', 'reg:next4')],
  ));
}

async function previewScreen(ctx) {
  const cfg = await loadConfig();
  const r = regData(ctx);
  await setState(ctx, 'reg_s05');
  return show(ctx, [
    '<b>Проверьте анкету</b>',
    `Никнейм: ${esc(r.nickname)}`,
    `Факультет: ${esc(r.faculty)}, ${r.course} курс`,
    `Пол: ${SEX[r.sex]}`,
    `WhatsApp: ${r.whatsapp ? esc(r.whatsapp) : 'не указан'}`,
    '',
    `<b>Правила.</b> ${esc(cfg.rules)}`,
    '',
    'Нажимая «Принять», вы соглашаетесь с правилами и обработкой данных профиля.',
  ].join('\n'), kb(
    [btn('Принять правила и продолжить', 'reg:accept')],
    [btn('Изменить', 'reg:edit'), btn('Отмена', 'reg:cancel')],
  ));
}

async function mainMenu(ctx) {
  await setState(ctx, null, {}, { replace: true });
  return send(ctx.chatId, `Здравствуйте, ${esc(ctx.user.nickname)}! Выберите действие.`, MENU);
}

async function finish(ctx) {
  const r = regData(ctx);
  const { user } = ctx;
  if (!r.nickname || !r.faculty || !r.course || !r.sex) return askNick(ctx);
  if (!r.whatsapp) return sexScreen(ctx);
  const patch = {
    nickname: r.nickname,
    faculty: r.faculty,
    course: r.course,
    sex: r.sex,
    whatsapp: r.whatsapp,
    registered: true,
    consentAt: new Date(),
  };
  if (!user.refCode) patch.refCode = await newRefCode();
  // The referral is bound once, at the first registration; self-invites never count.
  if (!user.registered && ctx.state.data.ref) {
    const referrer = await SbUser.findOne({ where: { refCode: ctx.state.data.ref } });
    if (referrer && referrer.id !== user.id && !await SbReferral.count({ where: { inviteeId: user.id } })) {
      patch.referredById = referrer.id;
      await SbReferral.create({ referrerId: referrer.id, inviteeId: user.id });
      await send(referrer.tgId, `👋 По вашей ссылке зарегистрировался ${esc(r.nickname)}. Бонус +3 дня обоим начислится, когда вы оба оплатите подписку.`);
    }
  }
  await user.update(patch);
  return mainMenu(ctx);
}

async function onStart(ctx, payload) {
  const { user } = ctx;
  if (!user.registered && payload?.startsWith('r_')) await setState(ctx, ctx.state.screen, { ref: payload.slice(2) });
  if (!user.registered) return welcome(ctx);
  if (!user.username) return needUsernameScreen(ctx, true);
  return mainMenu(ctx);
}

async function onCallback(ctx, data) {
  const [, action, arg] = data.split(':');
  const cfg = await loadConfig();
  switch (action) {
    case 'start0': return welcome(ctx);
    case 'start':
    case 'check':
      if (!ctx.user.username) {
        return needUsernameScreen(ctx).then(() => (action === 'check' ? ctx.answer('Пока не вижу @username в вашем профиле') : null));
      }
      return ctx.user.registered ? mainMenu(ctx) : askNick(ctx);
    case 'how': return show(ctx, USERNAME_HELP, kb([btn('Проверить', 'reg:check')]));
    case 'back2': return askNick(ctx);
    case 'back3': return facultyScreen(ctx);
    case 'fac':
      if (arg === 'other') {
        await saveReg(ctx, 'reg_fac_other', {});
        return show(ctx, 'Напишите название факультета.', kb([btn('Назад', 'reg:back3')]));
      }
      await saveReg(ctx, 'reg_s03', { faculty: cfg.faculties[Number(arg)] });
      return facultyScreen(ctx);
    case 'course':
      await saveReg(ctx, 'reg_s03', { course: Number(arg) });
      return facultyScreen(ctx);
    case 'next3': {
      const r = regData(ctx);
      if (!r.faculty || !r.course) return ctx.answer('Выберите факультет и курс');
      return sexScreen(ctx);
    }
    case 'sex':
      await saveReg(ctx, 'reg_s04', { sex: arg });
      return sexScreen(ctx);
    case 'next4':
      if (!regData(ctx).sex) return ctx.answer('Пол обязателен');
      if (!regData(ctx).whatsapp) return ctx.answer('Напишите номер WhatsApp сообщением: +996XXXXXXXXX', true);
      return previewScreen(ctx);
    case 'edit': return askNick(ctx);
    case 'cancel':
      await setState(ctx, null, { ref: ctx.state.data.ref }, { replace: true });
      return show(ctx, 'Регистрация не завершена. Вернуться можно в любой момент.', kb([btn('Начать', 'reg:start')]));
    case 'accept': return finish(ctx);
    default: return null;
  }
}

async function onText(ctx, text) {
  const screen = ctx.state.screen;
  if (screen === 'reg_nick') {
    const nick = text.trim();
    if (!nick || nick.length > 32 || NICK_BAD.test(nick)) {
      return send(ctx.chatId, 'Никнейм: от 1 до 32 символов, без ссылок, @ и телефонов. Попробуйте ещё раз.');
    }
    await saveReg(ctx, 'reg_s03', { nickname: nick });
    return facultyScreen(ctx);
  }
  if (screen === 'reg_fac_other') {
    const faculty = text.trim().slice(0, 120);
    if (faculty.length < 2) return send(ctx.chatId, 'Напишите название факультета.');
    await saveReg(ctx, 'reg_s03', { faculty });
    return facultyScreen(ctx);
  }
  if (screen === 'reg_s04') {
    const phone = text.replace(/[\s()-]/g, '');
    if (!WA.test(phone)) return send(ctx.chatId, 'Номер WhatsApp — в формате +996XXXXXXXXX, например +996700123456.');
    await saveReg(ctx, 'reg_s04', { whatsapp: phone });
    return regData(ctx).sex ? previewScreen(ctx) : sexScreen(ctx);
  }
  return null;
}

const SCREENS = ['reg_nick', 'reg_fac_other', 'reg_s04'];

module.exports = {
  onStart, onCallback, onText, mainMenu, SCREENS, NICK_BAD, WA,
};

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { SbOrder } = require('../models');
const { setState, requireDeal, loadConfig } = require('../ctx');
const { resolvePlace, busyUserIds } = require('../matching');
const { invalidateForOrder, notifyInvalidated } = require('../deals');
const {
  todayLocal, addDays, weekDates, parseDate, parseRange, humanDate, pairInterval, pairLabel,
} = require('../time');
const {
  esc, btn, kb, show, send, SEX, FACULTY_MODE,
} = require('../ui');

function form(ctx) {
  return ctx.state.data.of || {};
}

async function save(ctx, screen, patch) {
  await setState(ctx, screen, { of: { ...form(ctx), ...patch } });
}

// After an edit from the preview, go straight back to the preview.
async function next(ctx, step) {
  return form(ctx).editing ? preview(ctx) : step(ctx);
}

async function startOrder(ctx, preset = null) {
  if (!await requireDeal(ctx)) return null;
  const base = preset ? {
    placeKey: preset.placeKey,
    placeText: preset.placeText,
    requiredSex: preset.requiredSex,
    facultyMode: preset.facultyMode,
    faculty: preset.faculty,
    subject: preset.subject,
    description: preset.description,
    compensation: preset.compensation,
    comment: preset.comment,
    copy: true,
  } : {};
  await setState(ctx, 'of_date', { of: base });
  return dateStep(ctx);
}

async function dateStep(ctx) {
  await setState(ctx, 'of_date');
  return show(ctx, 'На какой день нужна помощь?', kb(
    [btn('Сегодня', 'of:date:today'), btn('Завтра', 'of:date:tomorrow'), btn('Другое', 'of:date:other')],
    [btn('Отмена', 'of:cancel')],
  ));
}

async function pairStep(ctx) {
  const cfg = await loadConfig();
  await setState(ctx, 'of_pair');
  return show(ctx, `Дата: <b>${esc(humanDate(form(ctx).date))}</b>\nВыберите пару. Для другого времени укажите начало и окончание.`, kb(
    ['1', '2', '3', '4'].map((n) => btn(`${n}-я · ${cfg.pairs[n][0]}`, `of:pair:${n}`)),
    [btn('Другое', 'of:pair:other')],
    [btn('Назад', 'of:back:date'), btn('Отмена', 'of:cancel')],
  ));
}

async function placeStep(ctx) {
  const cfg = await loadConfig();
  await setState(ctx, 'of_place');
  const main = cfg.places.filter((p) => p.kind === 'main');
  const hasBases = cfg.places.some((p) => p.kind === 'base');
  return show(ctx, 'Где требуется помощь? Выберите одно место.', kb(
    main.map((p) => btn(p.name, `of:place:${p.key}`)),
    [btn('Клиническая база', hasBases ? 'of:bases' : 'of:place:other'), btn('Другое место', 'of:place:other')],
    [btn('Назад', 'of:back:pair'), btn('Отмена', 'of:cancel')],
  ));
}

async function whoStep(ctx) {
  const f = form(ctx);
  await setState(ctx, 'of_who');
  const mark = (on, text) => (on ? `✅ ${text}` : text);
  const sex = f.requiredSex || 'any';
  const mode = f.facultyMode || 'any';
  return show(ctx, `Кто подходит для выполнения?${mode === 'specific' && f.faculty ? `\nФакультет: <b>${esc(f.faculty)}</b>` : ''}`, kb(
    [btn(mark(sex === 'm', 'Парень'), 'of:sex:m'), btn(mark(sex === 'f', 'Девушка'), 'of:sex:f'), btn(mark(sex === 'any', 'Не важно'), 'of:sex:any')],
    [btn(mark(mode === 'mine', 'Мой факультет'), 'of:fac:mine'), btn(mark(mode === 'any', 'Любой факультет'), 'of:fac:any'), btn(mark(mode === 'specific', 'Другой'), 'of:fac:specific')],
    [btn('Назад', 'of:back:place'), btn('Далее', 'of:next:who')],
  ));
}

async function subjectStep(ctx) {
  await setState(ctx, 'of_subject');
  return show(ctx, 'Укажите предмет (например: Анатомия). Если предмета нет — нажмите кнопку.', kb(
    [btn('Без предмета', 'of:nosubject')],
    [btn('Назад', 'of:back:who')],
  ));
}

async function descStep(ctx) {
  await setState(ctx, 'of_desc');
  return show(ctx, 'Опишите, что нужно сделать (от 20 до 500 символов). Только разрешённые задачи: материалы, конспекты, печать, поиск материалов, репетиторство и т. п.', kb([btn('Назад', 'of:back:subject')]));
}

async function compStep(ctx) {
  await setState(ctx, 'of_comp');
  return show(ctx, 'Условия вознаграждения: напишите текстом (например, «300 сом») или выберите вариант.', kb(
    [btn('По договорённости', 'of:comp:deal')],
    [btn('Назад', 'of:back:desc')],
  ));
}

async function commentStep(ctx) {
  await setState(ctx, 'of_comment');
  return show(ctx, 'Дополнительный комментарий (необязательно).', kb(
    [btn('Пропустить дополнительный комментарий', 'of:nocomment')],
    [btn('Назад', 'of:back:comp')],
  ));
}

function summary(f) {
  const faculty = f.facultyMode === 'specific' ? f.faculty : FACULTY_MODE[f.facultyMode || 'any'];
  return [
    `📅 ${esc(humanDate(f.date))}, ${esc(pairLabel(f.pairType, f.startsAt, f.endsAt))}`,
    `📍 ${esc(f.placeText)}`,
    `📚 ${esc(f.subject || 'Без предмета')}`,
    `📝 ${esc(f.description)}`,
    `👤 Исполнитель: ${SEX[f.requiredSex || 'any']} · ${esc(faculty)}`,
    `💰 ${esc(f.compensation)}`,
    f.comment ? `💬 ${esc(f.comment)}` : null,
  ].filter(Boolean).join('\n');
}

async function preview(ctx) {
  await save(ctx, 'of_preview', { editing: false });
  return show(ctx, `<b>Заявка${form(ctx).orderId ? ` №${form(ctx).orderId} (изменение)` : ''}</b>\n\n${summary(form(ctx))}`, kb(
    [btn('Опубликовать', 'of:publish')],
    [btn('Изменить', 'of:edit'), btn('Отменить', 'of:cancel')],
  ));
}

async function editMenu(ctx) {
  await save(ctx, 'of_preview', { editing: true });
  return show(ctx, 'Что изменить?', kb(
    [btn('Дату', 'of:back:date'), btn('Пару', 'of:back:pair'), btn('Место', 'of:back:place')],
    [btn('Кого ищем', 'of:back:who'), btn('Предмет', 'of:back:subject'), btn('Задачу', 'of:back:desc')],
    [btn('Вознаграждение', 'of:back:comp'), btn('Комментарий', 'of:back:comment')],
    [btn('К превью', 'of:preview')],
  ));
}

async function setDate(ctx, date) {
  const f = form(ctx);
  // A new date invalidates the chosen time, so the pair is always picked again.
  await save(ctx, 'of_pair', { date, pairType: f.date === date ? f.pairType : null });
  return pairStep(ctx);
}

async function setPair(ctx, pairType, custom = null) {
  const cfg = await loadConfig();
  const f = form(ctx);
  const interval = pairInterval(f.date, pairType, cfg.pairs, custom);
  if (!interval) return send(ctx.chatId, 'Для этой пары не задано время. Выберите «Другое».');
  if (interval.endsAt.getTime() <= Date.now()) return send(ctx.chatId, 'Это время уже прошло. Выберите другую пару или дату.');
  await save(ctx, 'of_place', { pairType, startsAt: interval.startsAt.toISOString(), endsAt: interval.endsAt.toISOString(), copy: false });
  // A copied request only re-checks date and time; everything else is already filled in.
  if ((f.editing || f.copy) && f.placeKey && f.description) return preview(ctx);
  return placeStep(ctx);
}

async function setPlace(ctx, place) {
  await save(ctx, 'of_who', { placeKey: place.key, placeText: place.text });
  return next(ctx, whoStep);
}

async function publish(ctx) {
  if (!await requireDeal(ctx)) return null;
  const f = form(ctx);
  const { user } = ctx;
  for (const key of ['date', 'pairType', 'startsAt', 'placeKey', 'description', 'compensation']) {
    if (!f[key]) return preview(ctx);
  }
  if (new Date(f.endsAt).getTime() <= Date.now()) return show(ctx, 'Время заявки уже прошло. Измените дату или пару.', kb([btn('Изменить', 'of:edit')]));
  const startsAt = new Date(f.startsAt);
  const endsAt = new Date(f.endsAt);
  if ((await busyUserIds([user.id], startsAt, endsAt)).size) {
    return show(ctx, 'У вас уже есть подтверждённый заказ на это время. Выберите другое время.', kb([btn('Изменить', 'of:edit'), btn('Отменить', 'of:cancel')]));
  }
  const dupe = await SbOrder.findOne({
    where: {
      creatorId: user.id, status: 'OPEN', date: f.date, startsAt, placeKey: f.placeKey, ...(f.orderId ? { id: { [Op.ne]: f.orderId } } : {}),
    },
  });
  if (dupe) return show(ctx, `Такая заявка уже опубликована (№${dupe.id}).`, kb([btn('Открыть её', `my:open:${dupe.id}`), btn('Изменить', 'of:edit')]));

  const fields = {
    date: f.date,
    pairType: f.pairType,
    startsAt,
    endsAt,
    placeKey: f.placeKey,
    placeText: f.placeText,
    subject: f.subject || null,
    description: f.description,
    compensation: f.compensation,
    comment: f.comment || null,
    requiredSex: f.requiredSex || 'any',
    facultyMode: f.facultyMode || 'any',
    faculty: f.facultyMode === 'mine' ? user.faculty : (f.facultyMode === 'specific' ? f.faculty : null),
  };
  let order;
  let invalidated = null;
  if (f.orderId) {
    const res = await sequelize.transaction(async (transaction) => {
      const o = await SbOrder.findByPk(f.orderId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!o || o.creatorId !== user.id || o.status !== 'OPEN') return null;
      await o.update({ ...fields, revision: o.revision + 1 }, { transaction });
      return { o, inv: await invalidateForOrder(o.id, 'заказчик изменил условия заявки', transaction, user.id) };
    });
    if (!res) return show(ctx, 'Эту заявку уже нельзя изменить: её приняли или отменили.');
    order = res.o;
    invalidated = res.inv;
  } else {
    order = await SbOrder.create({ ...fields, creatorId: user.id });
  }
  await setState(ctx, null, {}, { replace: true });
  if (invalidated) await notifyInvalidated(invalidated);
  // eslint-disable-next-line global-require
  const deal = require('./deal');
  await deal.notifyExecutorsAboutOrder(order, user);
  return deal.executorFeed(ctx, order.id, 0, { justPublished: true });
}

async function onCallback(ctx, data) {
  const [, action, arg] = data.split(':');
  const cfg = await loadConfig();
  const f = form(ctx);
  switch (action) {
    case 'date':
      if (arg === 'today') return setDate(ctx, todayLocal());
      if (arg === 'tomorrow') return setDate(ctx, addDays(todayLocal(), 1));
      if (arg === 'other') {
        await setState(ctx, 'of_date_other');
        return show(ctx, 'Выберите дату (в пределах 7 дней) или напишите её, например 25.10.', kb(
          ...weekDates().map((d) => [btn(humanDate(d), `of:day:${d}`)]),
          [btn('Назад', 'of:back:date')],
        ));
      }
      return null;
    case 'day': return weekDates().includes(arg) ? setDate(ctx, arg) : dateStep(ctx);
    case 'pair':
      if (arg === 'other') {
        await setState(ctx, 'of_time');
        return show(ctx, 'Напишите начало и окончание, например 10:00-11:30.', kb([btn('Назад', 'of:back:pair')]));
      }
      return setPair(ctx, arg);
    case 'place':
      if (arg === 'other') {
        await setState(ctx, 'of_place_text');
        return show(ctx, 'Напишите название места.', kb([btn('Назад', 'of:back:place')]));
      }
      return setPlace(ctx, { key: arg, text: cfg.places.find((p) => p.key === arg)?.name || arg });
    case 'bases':
      return show(ctx, 'Выберите клиническую базу или напишите название.', kb(
        ...cfg.places.filter((p) => p.kind === 'base').map((p) => [btn(p.name, `of:place:${p.key}`)]),
        [btn('Написать название', 'of:place:other'), btn('Назад', 'of:back:place')],
      ));
    case 'sex':
      await save(ctx, 'of_who', { requiredSex: arg });
      return whoStep(ctx);
    case 'fac':
      if (arg === 'specific') {
        await setState(ctx, 'of_fac_text');
        return show(ctx, 'Выберите факультет исполнителя или напишите его.', kb(
          ...cfg.faculties.map((name, i) => [btn(name, `of:facx:${i}`)]),
          [btn('Назад', 'of:back:who')],
        ));
      }
      await save(ctx, 'of_who', { facultyMode: arg, faculty: null });
      return whoStep(ctx);
    case 'facx':
      await save(ctx, 'of_who', { facultyMode: 'specific', faculty: cfg.faculties[Number(arg)] });
      return whoStep(ctx);
    case 'next':
      return next(ctx, subjectStep);
    case 'nosubject':
      await save(ctx, 'of_desc', { subject: null });
      return next(ctx, descStep);
    case 'comp':
      await save(ctx, 'of_comment', { compensation: 'По договорённости' });
      return next(ctx, commentStep);
    case 'nocomment':
      await save(ctx, 'of_preview', { comment: null });
      return preview(ctx);
    case 'back': {
      const steps = {
        date: dateStep, pair: pairStep, place: placeStep, who: whoStep, subject: subjectStep, desc: descStep, comp: compStep, comment: commentStep,
      };
      if (arg === 'pair' && !f.date) return dateStep(ctx);
      return (steps[arg] || dateStep)(ctx);
    }
    case 'preview': return preview(ctx);
    case 'edit': return editMenu(ctx);
    case 'publish': return publish(ctx);
    case 'cancel':
      await setState(ctx, null, {}, { replace: true });
      return show(ctx, 'Черновик заявки удалён.');
    default: return null;
  }
}

async function onText(ctx, text) {
  const value = text.trim();
  const cfg = await loadConfig();
  switch (ctx.state.screen) {
    case 'of_date_other': {
      const date = parseDate(value);
      if (!date) return send(ctx.chatId, 'Дата должна быть в пределах 7 дней, включая сегодня. Например: 25.10.');
      return setDate(ctx, date);
    }
    case 'of_time': {
      const range = parseRange(value);
      if (!range) return send(ctx.chatId, 'Формат: 10:00-11:30, конец позже начала.');
      return setPair(ctx, 'other', range);
    }
    case 'of_place_text':
      if (value.length < 2) return send(ctx.chatId, 'Напишите название места.');
      return setPlace(ctx, resolvePlace(value.slice(0, 200), cfg));
    case 'of_fac_text':
      await save(ctx, 'of_who', { facultyMode: 'specific', faculty: value.slice(0, 120) });
      return whoStep(ctx);
    case 'of_subject':
      await save(ctx, 'of_desc', { subject: value.slice(0, 120) });
      return next(ctx, descStep);
    case 'of_desc':
      if (value.length < 20 || value.length > 500) return send(ctx.chatId, `Описание — от 20 до 500 символов (сейчас ${value.length}).`);
      await save(ctx, 'of_comp', { description: value });
      return next(ctx, compStep);
    case 'of_comp':
      await save(ctx, 'of_comment', { compensation: value.slice(0, 200) });
      return next(ctx, commentStep);
    case 'of_comment':
      await save(ctx, 'of_preview', { comment: value.slice(0, 500) });
      return preview(ctx);
    default: return null;
  }
}

const SCREENS = ['of_date_other', 'of_time', 'of_place_text', 'of_fac_text', 'of_subject', 'of_desc', 'of_comp', 'of_comment'];

module.exports = {
  startOrder, onCallback, onText, SCREENS, form,
};

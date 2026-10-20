const { SbSlot } = require('../models');
const { setState, requireDeal, loadConfig } = require('../ctx');
const { resolvePlace, busyUserIds } = require('../matching');
const {
  todayLocal, addDays, weekDates, parseRange, humanDate, pairInterval,
} = require('../time');
const {
  esc, btn, kb, show, send, SEX, FACULTY_MODE,
} = require('../ui');

const mark = (on, text) => (on ? `✅ ${text}` : text);

function form(ctx) {
  return ctx.state.data.sf || { dates: [], pairs: [], places: [], customerSex: 'any', facultyMode: 'any' };
}

async function save(ctx, screen, patch) {
  await setState(ctx, screen, { sf: { ...form(ctx), ...patch } });
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

async function startSlots(ctx) {
  if (!await requireDeal(ctx)) return null;
  await setState(ctx, 'sf_days', { sf: { dates: [], pairs: [], places: [], customerSex: 'any', facultyMode: 'any' } });
  return daysStep(ctx);
}

function dayLabel(d) {
  if (d === todayLocal()) return 'Сегодня';
  if (d === addDays(todayLocal(), 1)) return 'Завтра';
  return humanDate(d);
}

async function daysStep(ctx) {
  const f = form(ctx);
  await setState(ctx, 'sf_days');
  return show(ctx, 'Когда вы можете выполнять задачи? Отметьте один или несколько дней на ближайшую неделю.', kb(
    ...weekDates().map((d) => [btn(mark(f.dates.includes(d), dayLabel(d)), `sf:day:${d}`)]),
    [btn('Отмена', 'sf:cancel'), btn('Далее', 'sf:next:pairs')],
  ));
}

async function pairsStep(ctx) {
  const cfg = await loadConfig();
  const f = form(ctx);
  await setState(ctx, 'sf_pairs');
  return show(ctx, `На каких парах или в какое время вы свободны? Выбор действует для всех отмеченных дней.${f.custom ? `\nСвоё время: <b>${f.custom[0]}–${f.custom[1]}</b>` : ''}`, kb(
    ['1', '2', '3', '4'].map((n) => btn(mark(f.pairs.includes(n), `${n}-я · ${cfg.pairs[n][0]}`), `sf:pair:${n}`)),
    [btn(mark(!!f.custom, f.custom ? 'Другое ✎' : 'Другое'), 'sf:pair:other')],
    [btn('Назад', 'sf:back:days'), btn('Далее', 'sf:next:places')],
  ));
}

async function placesStep(ctx, showBases = false) {
  const cfg = await loadConfig();
  const f = form(ctx);
  await setState(ctx, 'sf_places');
  const has = (key) => f.places.some((p) => p.key === key);
  const main = cfg.places.filter((p) => p.kind === 'main');
  const bases = cfg.places.filter((p) => p.kind === 'base');
  const custom = f.places.filter((p) => !cfg.places.some((c) => c.key === p.key));
  return show(ctx, `Где готовы выполнять задания? Можно выбрать несколько мест.${custom.length ? `\nСвои места: ${custom.map((p) => esc(p.text)).join(', ')}` : ''}`, kb(
    ...main.map((p) => [btn(mark(has(p.key), p.name), `sf:place:${p.key}`)]),
    ...(showBases ? bases.map((p) => [btn(mark(has(p.key), p.name), `sf:place:${p.key}`)]) : []),
    [bases.length && !showBases ? btn('Клинические базы', 'sf:bases') : null, btn('Другое место', 'sf:place:other')].filter(Boolean),
    [btn('Назад', 'sf:back:pairs'), btn('Далее', 'sf:next:who')],
  ));
}

async function whoStep(ctx) {
  const f = form(ctx);
  await setState(ctx, 'sf_who');
  return show(ctx, 'Для кого готовы выполнять задания?', kb(
    [btn(mark(f.customerSex === 'm', 'Парень'), 'sf:csex:m'), btn(mark(f.customerSex === 'f', 'Девушка'), 'sf:csex:f'), btn(mark(f.customerSex === 'any', 'Не важно'), 'sf:csex:any')],
    [btn(mark(f.facultyMode === 'mine', 'Мой факультет'), 'sf:cfac:mine'), btn(mark(f.facultyMode === 'any', 'Любой факультет'), 'sf:cfac:any')],
    [btn('Назад', 'sf:back:places'), btn('Далее', 'sf:next:review')],
  ));
}

async function reviewStep(ctx) {
  const cfg = await loadConfig();
  const f = form(ctx);
  await setState(ctx, 'sf_review');
  const pairs = [...f.pairs.sort().map((n) => `${n}-я (${cfg.pairs[n].join('–')})`), ...(f.custom ? [`${f.custom[0]}–${f.custom[1]}`] : [])];
  return show(ctx, [
    '<b>Свободные слоты</b>',
    `Дни: ${f.dates.sort().map((d) => esc(humanDate(d))).join(', ')}`,
    `Время: ${pairs.join(', ')}`,
    `Места: ${f.places.map((p) => esc(p.text)).join(', ')}`,
    `Для: ${SEX[f.customerSex]} · ${FACULTY_MODE[f.facultyMode]}`,
    '',
    'Слоты будут активны до окончания своего времени.',
  ].join('\n'), kb(
    [btn('Сохранить и найти заказы', 'sf:save')],
    [btn('Изменить', 'sf:back:days'), btn('Отмена', 'sf:cancel')],
  ));
}

async function saveSlots(ctx) {
  if (!await requireDeal(ctx)) return null;
  const cfg = await loadConfig();
  const f = form(ctx);
  const { user } = ctx;
  const ranges = [...f.pairs.map((n) => ({ pairType: n })), ...(f.custom ? [{ pairType: 'other', custom: f.custom }] : [])];
  let created = 0;
  let skipped = 0;
  const saved = [];
  for (const date of f.dates) {
    for (const r of ranges) {
      const interval = pairInterval(date, r.pairType, cfg.pairs, r.custom);
      if (!interval || interval.endsAt.getTime() <= Date.now()) { skipped += 1; continue; }
      if ((await busyUserIds([user.id], interval.startsAt, interval.endsAt)).size) { skipped += 1; continue; }
      const fields = { places: f.places, customerSex: f.customerSex, facultyMode: f.facultyMode };
      const existing = await SbSlot.findOne({ where: { userId: user.id, date, startsAt: interval.startsAt, endsAt: interval.endsAt, state: 'OPEN' } });
      if (existing) {
        await existing.update(fields);
        saved.push(existing);
      } else {
        saved.push(await SbSlot.create({ userId: user.id, date, pairType: r.pairType, ...interval, ...fields }));
        created += 1;
      }
    }
  }
  await setState(ctx, null, {}, { replace: true });
  if (!saved.length) return show(ctx, 'Ничего не сохранено: выбранное время уже прошло или занято подтверждёнными заказами.', kb([btn('Выбрать заново', 'sf:restart')]));
  // eslint-disable-next-line global-require
  const deal = require('./deal');
  await deal.notifyCustomersAboutSlots(saved, user);
  return deal.orderFeed(ctx, 0, { header: `Сохранено слотов: ${saved.length}${created < saved.length ? ` (обновлено ${saved.length - created})` : ''}${skipped ? `, пропущено: ${skipped} (время прошло или занято)` : ''}.` });
}

async function onCallback(ctx, data) {
  const [, action, arg] = data.split(':');
  const cfg = await loadConfig();
  const f = form(ctx);
  switch (action) {
    case 'restart': return startSlots(ctx);
    case 'day':
      if (!weekDates().includes(arg)) return daysStep(ctx);
      await save(ctx, 'sf_days', { dates: toggle(f.dates, arg) });
      return daysStep(ctx);
    case 'pair':
      if (arg === 'other') {
        if (f.custom) {
          await save(ctx, 'sf_pairs', { custom: null });
          return pairsStep(ctx);
        }
        await setState(ctx, 'sf_time');
        return show(ctx, 'Напишите свободный интервал, например 15:00-18:00.', kb([btn('Назад', 'sf:back:pairs')]));
      }
      await save(ctx, 'sf_pairs', { pairs: toggle(f.pairs, arg) });
      return pairsStep(ctx);
    case 'place': {
      if (arg === 'other') {
        await setState(ctx, 'sf_place_text');
        return show(ctx, 'Напишите название места.', kb([btn('Назад', 'sf:back:places')]));
      }
      const p = cfg.places.find((x) => x.key === arg);
      if (!p) return placesStep(ctx);
      const has = f.places.some((x) => x.key === arg);
      await save(ctx, 'sf_places', { places: has ? f.places.filter((x) => x.key !== arg) : [...f.places, { key: p.key, text: p.name }] });
      return placesStep(ctx, p.kind === 'base');
    }
    case 'bases': return placesStep(ctx, true);
    case 'csex':
      await save(ctx, 'sf_who', { customerSex: arg });
      return whoStep(ctx);
    case 'cfac':
      await save(ctx, 'sf_who', { facultyMode: arg });
      return whoStep(ctx);
    case 'next':
      if (arg === 'pairs') return f.dates.length ? pairsStep(ctx) : ctx.answer('Отметьте хотя бы один день');
      if (arg === 'places') return f.pairs.length || f.custom ? placesStep(ctx) : ctx.answer('Выберите пару или своё время');
      if (arg === 'who') return f.places.length ? whoStep(ctx) : ctx.answer('Выберите хотя бы одно место');
      return reviewStep(ctx);
    case 'back': {
      const steps = {
        days: daysStep, pairs: pairsStep, places: placesStep, who: whoStep,
      };
      return (steps[arg] || daysStep)(ctx);
    }
    case 'save': return saveSlots(ctx);
    case 'cancel':
      await setState(ctx, null, {}, { replace: true });
      return show(ctx, 'Выбор доступности отменён.');
    default: return null;
  }
}

async function onText(ctx, text) {
  const cfg = await loadConfig();
  const f = form(ctx);
  if (ctx.state.screen === 'sf_time') {
    const range = parseRange(text);
    if (!range) return send(ctx.chatId, 'Формат: 15:00-18:00, конец позже начала.');
    await save(ctx, 'sf_pairs', { custom: range });
    return pairsStep(ctx);
  }
  if (ctx.state.screen === 'sf_place_text') {
    if (text.trim().length < 2) return send(ctx.chatId, 'Напишите название места.');
    const place = resolvePlace(text.trim().slice(0, 200), cfg);
    if (!f.places.some((p) => p.key === place.key)) await save(ctx, 'sf_places', { places: [...f.places, { key: place.key, text: place.text }] });
    return placesStep(ctx);
  }
  return null;
}

const SCREENS = ['sf_time', 'sf_place_text'];

module.exports = {
  startSlots, onCallback, onText, SCREENS,
};

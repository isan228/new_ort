const { getSetting, setSetting } = require('../models/AppSetting');

// Defaults for the pilot; the admin edits them in /admin → Настройки.
// Pair times are placeholders until the real timetable is confirmed (ТЗ, раздел 13).
const DEFAULTS = {
  faculties: ['Лечебное дело', 'Педиатрия', 'Стоматология'],
  places: [
    { key: 'main', name: 'Главный корпус', kind: 'main', synonyms: ['главный', 'гк', 'главный корпус'] },
  ],
  pairs: { 1: ['08:30', '10:00'], 2: ['10:10', '11:40'], 3: ['12:20', '13:50'], 4: ['14:00', '15:30'] },
  launchAt: null,
  promoHours: 72,
  // Admin switch: everyone gets access with no end date, regardless of LAUNCH_AT and payments.
  freeMode: false,
  tariffs: [{ days: 7, price: '' }, { days: 30, price: '' }],
  paymentsEnabled: true,
  rules: 'Сервис только для разрешённых студенческих задач: передача и получение материалов, конспекты, печать, поиск учебных материалов, репетиторство. Запрещены подмена личности, фиктивное присутствие, ложные данные о посещаемости, сдача экзаменов за другого и любые нарушения правил вуза или закона.',
};

const KEYS = Object.keys(DEFAULTS);
let cache = null;

async function loadConfig() {
  if (cache) return cache;
  const out = {};
  for (const key of KEYS) {
    const raw = await getSetting(`sb.${key}`);
    out[key] = raw == null ? DEFAULTS[key] : JSON.parse(raw);
  }
  cache = out;
  return out;
}

async function saveConfig(key, value) {
  if (!KEYS.includes(key)) throw new Error(`Unknown setting ${key}`);
  await setSetting(`sb.${key}`, JSON.stringify(value));
  cache = null;
}

function resetConfigCache() {
  cache = null;
}

module.exports = { loadConfig, saveConfig, resetConfigCache, DEFAULTS };

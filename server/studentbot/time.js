// Asia/Bishkek is UTC+6 all year (no DST), so conversions are plain arithmetic.
const OFFSET_MS = 6 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function todayLocal(now = Date.now()) {
  return new Date(now + OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The week of choice: today and the next six days.
function weekDates(now = Date.now()) {
  const today = todayLocal(now);
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

function localToUtc(iso, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.parse(`${iso}T00:00:00Z`) + h * HOUR + m * MIN - OFFSET_MS);
}

function localTime(date) {
  return new Date(new Date(date).getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

function parseTime(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

// "10:00-11:30", "10.00 – 11.30"
function parseRange(text) {
  const parts = String(text || '').split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return null;
  const from = parseTime(parts[0]);
  const to = parseTime(parts[1]);
  if (!from || !to || to <= from) return null;
  return [from, to];
}

// "25.10" / "25.10.2026" within the week of choice.
function parseDate(text, now = Date.now()) {
  const m = String(text || '').trim().match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (!m) return null;
  const week = weekDates(now);
  const day = Number(m[1]);
  const month = Number(m[2]);
  const years = m[3] ? [Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])] : [...new Set(week.map((d) => Number(d.slice(0, 4))))];
  for (const year of years) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (week.includes(iso)) return iso;
  }
  return null;
}

function humanDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' }).format(d);
}

function humanDateTime(date) {
  if (!date) return '—';
  const d = new Date(new Date(date).getTime() + OFFSET_MS);
  const iso = d.toISOString();
  return `${humanDate(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
}

function pairInterval(date, pairType, pairs, custom) {
  const range = pairType === 'other' ? custom : pairs[pairType];
  if (!range) return null;
  return { startsAt: localToUtc(date, range[0]), endsAt: localToUtc(date, range[1]) };
}

function pairLabel(pairType, startsAt, endsAt) {
  const time = `${localTime(startsAt)}–${localTime(endsAt)}`;
  return pairType === 'other' ? time : `${pairType}-я пара (${time})`;
}

module.exports = {
  MIN,
  HOUR,
  DAY,
  todayLocal,
  addDays,
  weekDates,
  localToUtc,
  localTime,
  parseTime,
  parseRange,
  parseDate,
  humanDate,
  humanDateTime,
  pairInterval,
  pairLabel,
};

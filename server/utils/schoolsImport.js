const { School } = require('../models');

// Public school directory of bilim.akipress.org: 100 schools per page, ~23 pages.
const SOURCE = 'https://bilim.akipress.org/profiles:3/school/list/';
const MAX_PAGES = 60;
const PAUSE_MS = 400;

function decode(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePage(html) {
  const rows = [];
  const re = /<tr><td>[\s\S]*?<\/td><td><a[^>]*href='\/profile:(\d+)\/[^']*'[^>]*>([\s\S]*?)<\/a><\/td><td>([\s\S]*?)<\/td>/g;
  for (const m of html.matchAll(re)) {
    const name = decode(m[2]);
    if (name) rows.push({ sourceId: Number(m[1]), name: name.slice(0, 300), address: decode(m[3]).slice(0, 500) });
  }
  return rows;
}

// "Чуйская область, Панфиловский район c.Кум-Арык …" → region and district; free-form addresses stay unsplit.
function splitAddress(address) {
  const [head = '', ...rest] = String(address || '').split(',').map((s) => s.trim());
  if (!/(область|^Бишкек$|^Ош$)/i.test(head)) return { region: null, district: null };
  const tail = rest.join(', ');
  const m = tail.match(/^(.*?\sрайон|г\.\s*[^\s,]+)/i) || tail.match(/^([^\s,]+\sрайон)/i);
  return { region: head, district: m ? m[1].trim() : null };
}

async function fetchPage(page) {
  const url = page === 1 ? SOURCE : `${SOURCE}/page:${page}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ORT.KG schools directory)' } });
  if (!res.ok) throw new Error(`bilim.akipress.org ответил ${res.status} на странице ${page}`);
  return parsePage(await res.text());
}

async function fetchAllSchools() {
  const all = new Map();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const rows = await fetchPage(page);
    if (!rows.length) break;
    rows.forEach((row) => all.set(row.sourceId, row));
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  return [...all.values()];
}

// Upserts by the source id, so a repeated import refreshes names/addresses and never duplicates.
// Schools the admin edited by hand keep their edits; hidden schools stay hidden.
async function importSchools() {
  const rows = await fetchAllSchools();
  if (!rows.length) throw new Error('На странице bilim.akipress.org не найдено ни одной школы — возможно, сайт поменял вёрстку');
  const existing = new Map((await School.findAll({ where: { sourceId: rows.map((r) => r.sourceId) } })).map((s) => [s.sourceId, s]));
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const fields = { name: row.name, address: row.address, ...splitAddress(row.address) };
    const current = existing.get(row.sourceId);
    if (!current) {
      await School.create({ ...fields, sourceId: row.sourceId, source: 'bilim' });
      created += 1;
    } else if (!current.editedByAdmin && (current.name !== fields.name || current.address !== fields.address)) {
      await current.update(fields);
      updated += 1;
    }
  }
  return { fetched: rows.length, created, updated, unchanged: rows.length - created - updated };
}

module.exports = { importSchools, splitAddress, parsePage };

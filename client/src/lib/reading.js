export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

export function splitParagraphs(body) {
  return String(body || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

function cleanQuote(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«"„“'…\s]+|[»"”'…\s]+$/g, '')
    .trim();
}

// Returns one range per paragraph touched by the quote: [{ index, start, end }].
export function findEvidence(paragraphs, evidence) {
  const quote = cleanQuote(evidence).toLowerCase();
  if (quote.length < 3) return [];
  const lower = paragraphs.map((p) => p.toLowerCase());

  for (let i = 0; i < lower.length; i += 1) {
    const at = lower[i].indexOf(quote);
    if (at >= 0) return [{ index: i, start: at, end: at + quote.length }];
  }

  const joined = lower.join(' ');
  const at = joined.indexOf(quote);
  if (at < 0) return [];
  const ranges = [];
  let offset = 0;
  for (let i = 0; i < lower.length; i += 1) {
    const from = offset;
    const to = offset + lower[i].length;
    const start = Math.max(at, from);
    const end = Math.min(at + quote.length, to);
    if (start < end) ranges.push({ index: i, start: start - from, end: end - from });
    offset = to + 1;
  }
  return ranges;
}

export function paragraphParts(text, range) {
  if (!range) return [{ text, mark: false }];
  return [
    { text: text.slice(0, range.start), mark: false },
    { text: text.slice(range.start, range.end), mark: true },
    { text: text.slice(range.end), mark: false },
  ].filter((part) => part.text);
}

export function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-яөүңҗ\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTagName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = { slugify, normalizeTagName };

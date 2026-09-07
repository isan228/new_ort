const { QuestionTag } = require('../models');
const { slugify, normalizeTagName } = require('./ortTagNormalize');

async function findOrCreateTag(name, kind = 'topic', subjectId = null) {
  const clean = normalizeTagName(name);
  if (!clean) return null;
  const base = slugify(clean);
  const slug = subjectId ? `${base}-${subjectId}` : base;
  const [tag] = await QuestionTag.findOrCreate({
    where: { slug },
    defaults: { name: clean, slug, kind, isActive: true, subjectId: subjectId || null },
  });
  return tag;
}

module.exports = { findOrCreateTag };

const { QuestionTag } = require('../models');
const { slugify, normalizeTagName } = require('./ortTagNormalize');

async function findOrCreateTag(name, kind = 'topic') {
  const clean = normalizeTagName(name);
  if (!clean) return null;
  const slug = slugify(clean);
  const [tag] = await QuestionTag.findOrCreate({
    where: { slug },
    defaults: { name: clean, slug, kind, isActive: true },
  });
  return tag;
}

module.exports = { findOrCreateTag };

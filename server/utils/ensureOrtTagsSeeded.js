const { QuestionTag } = require('../models');
const { catalogEntries } = require('./ortTagCatalog');

async function ensureOrtTagsSeeded() {
  const entries = catalogEntries();
  for (const entry of entries) {
    const existing = await QuestionTag.findOne({ where: { slug: entry.slug } });
    if (!existing) {
      await QuestionTag.create(entry);
    }
  }
}

module.exports = { ensureOrtTagsSeeded };

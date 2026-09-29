const {
  Question,
  QuestionTag,
  QuestionTagMap,
  ReadingPassage,
  ReadingPassageTagMap,
  Test,
} = require('../models');
const { findOrCreateTag } = require('./findOrCreateTag');

function normalizeTagInput(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(',');
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim();
    const kind = typeof item === 'object' && item?.kind === 'skill' ? 'skill' : 'topic';
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, kind });
  }
  return out;
}

async function passageTagIds(passageId) {
  const rows = await ReadingPassageTagMap.findAll({ where: { passageId } });
  return rows.map((row) => row.tagId);
}

async function passageQuestionIds(passageId) {
  const rows = await Question.findAll({ where: { passageId }, attributes: ['id'] });
  return rows.map((row) => row.id);
}

async function addTagsToQuestions(questionIds, tagIds) {
  for (const questionId of questionIds) {
    for (const tagId of tagIds) {
      await QuestionTagMap.findOrCreate({
        where: { questionId, tagId },
        defaults: { questionId, tagId },
      });
    }
  }
}

// Passage tags are mirrored onto every question of the passage so topic stats keep working.
async function setPassageTags(passage, tags) {
  const test = await Test.findByPk(passage.testId);
  const wanted = [];
  for (const tag of normalizeTagInput(tags)) {
    const row = await findOrCreateTag(tag.name, tag.kind, test?.subjectId || null);
    if (row) wanted.push(row.id);
  }
  const before = await passageTagIds(passage.id);
  const removed = before.filter((id) => !wanted.includes(id));
  const added = wanted.filter((id) => !before.includes(id));

  if (removed.length) {
    await ReadingPassageTagMap.destroy({ where: { passageId: passage.id, tagId: removed } });
  }
  for (const tagId of added) {
    await ReadingPassageTagMap.findOrCreate({
      where: { passageId: passage.id, tagId },
      defaults: { passageId: passage.id, tagId },
    });
  }

  const questionIds = await passageQuestionIds(passage.id);
  if (questionIds.length && removed.length) {
    await QuestionTagMap.destroy({ where: { questionId: questionIds, tagId: removed } });
  }
  await addTagsToQuestions(questionIds, added);
}

async function applyPassageTags(passageId, questionIds) {
  if (!passageId || !questionIds.length) return;
  await addTagsToQuestions(questionIds, await passageTagIds(passageId));
}

function publicTags(passage) {
  return (passage.QuestionTags || []).map((tag) => ({ id: tag.id, name: tag.name, kind: tag.kind }));
}

async function destroyPassageTags(where) {
  const passages = await ReadingPassage.findAll({ where, attributes: ['id'] });
  const ids = passages.map((p) => p.id);
  if (ids.length) await ReadingPassageTagMap.destroy({ where: { passageId: ids } });
}

const passageTagInclude = {
  model: QuestionTag,
  attributes: ['id', 'name', 'kind'],
  through: { attributes: [] },
  required: false,
};

module.exports = {
  setPassageTags,
  applyPassageTags,
  publicTags,
  destroyPassageTags,
  passageTagInclude,
};

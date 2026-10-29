const express = require('express');
const { Op } = require('sequelize');
const {
  Subject,
  Test,
  Question,
  Answer,
  QuestionTagMap,
  ReadingPassage,
  SimVariant,
  SimBlock,
  SimTopic,
  SimVersion,
  SimAttempt,
} = require('../models');
const { destroyPassageTags } = require('../utils/passageTags');
const { templateFor } = require('../utils/simCatalog');
const {
  SIM_FORMATS,
  DIFFICULTIES,
  byOrder,
  loadVariantTree,
  variantProblems,
  publishVariant,
} = require('../utils/simStructure');

const router = express.Router();

const TRACKS = ['main', 'subject', 'state_lang'];

function cleanName(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function positiveInt(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function simSubject(id) {
  return Subject.findOne({ where: { id, bank: 'simulation' } });
}

async function destroySlots(testIds) {
  if (!testIds.length) return;
  const questions = await Question.findAll({ where: { testId: testIds }, attributes: ['id'] });
  const qids = questions.map((q) => q.id);
  if (qids.length) {
    await Answer.destroy({ where: { questionId: qids } });
    await QuestionTagMap.destroy({ where: { questionId: qids } });
    await Question.destroy({ where: { id: qids } });
  }
  await destroyPassageTags({ testId: testIds });
  await ReadingPassage.destroy({ where: { testId: testIds } });
  await Test.destroy({ where: { id: testIds } });
}

async function destroyParts(partIds) {
  if (!partIds.length) return;
  const slots = await Test.findAll({ where: { parentId: partIds }, attributes: ['id'] });
  await destroySlots([...partIds, ...slots.map((s) => s.id)]);
}

async function destroyBlocks(blockIds) {
  if (!blockIds.length) return;
  const parts = await Test.findAll({ where: { simBlockId: blockIds }, attributes: ['id'] });
  await destroyParts(parts.map((p) => p.id));
  await SimBlock.destroy({ where: { id: blockIds } });
}

// Published snapshots and attempts are kept: results must survive structure changes.
async function destroyVariants(variantIds) {
  if (!variantIds.length) return;
  const blocks = await SimBlock.findAll({ where: { variantId: variantIds }, attributes: ['id'] });
  await destroyBlocks(blocks.map((b) => b.id));
  await SimVariant.destroy({ where: { id: variantIds } });
}

async function nextOrder(Model, where) {
  return ((await Model.max('sortOrder', { where })) || 0) + 1;
}

async function createPart(block, subjectId, { name, format, count }) {
  return Test.create({
    name,
    subjectId,
    bank: 'simulation',
    kind: format,
    simFormat: format,
    simBlockId: block.id,
    requiredCount: count,
    hasExplanations: true,
    isActive: true,
    sortOrder: await nextOrder(Test, { simBlockId: block.id }),
  });
}

async function createFromTemplate(variant, subject) {
  for (const [index, spec] of templateFor(subject).entries()) {
    const block = await SimBlock.create({ variantId: variant.id, title: spec.title, minutes: spec.minutes, sortOrder: index + 1 });
    for (const part of spec.parts) await createPart(block, subject.id, part);
  }
}

function slotRow({ slot, topic, content }) {
  return {
    slotId: slot.id,
    topicId: topic?.id || null,
    name: topic?.name || slot.name,
    count: content.ordered.length,
    passages: content.passages.length,
  };
}

function treeJson(loaded) {
  const { variant, subject, tree } = loaded;
  const blocks = tree.map(({ block, parts }) => ({
    id: block.id,
    title: block.title,
    minutes: block.minutes,
    parts: parts.map(({ part, topics, content, count }) => ({
      id: part.id,
      name: part.name,
      format: part.simFormat,
      requiredCount: part.requiredCount,
      count,
      ownCount: content.ordered.length,
      topics: topics.map(slotRow),
    })),
  }));
  const required = blocks.reduce((sum, b) => sum + b.parts.reduce((s, p) => s + (p.requiredCount || 0), 0), 0);
  const count = blocks.reduce((sum, b) => sum + b.parts.reduce((s, p) => s + p.count, 0), 0);
  return {
    subject: { id: subject.id, name: subject.name, trackGroup: subject.trackGroup, language: subject.language },
    variant: {
      id: variant.id,
      number: variant.number,
      difficulty: variant.difficulty,
      status: variant.status,
      allowRetake: variant.allowRetake,
      publishedVersionId: variant.publishedVersionId,
    },
    blocks,
    totals: { required, count, minutes: blocks.reduce((sum, b) => sum + b.minutes, 0) },
  };
}

async function variantJson(variantId) {
  const loaded = await loadVariantTree(variantId);
  if (!loaded) return null;
  const json = treeJson(loaded);
  const [published, versions, attempts] = await Promise.all([
    loaded.variant.publishedVersionId
      ? SimVersion.findByPk(loaded.variant.publishedVersionId, { attributes: ['id', 'version', 'questionCount', 'minutes', 'createdAt'] })
      : null,
    SimVersion.count({ where: { variantId } }),
    SimAttempt.count({ where: { variantId } }),
  ]);
  return {
    ...json,
    published: published ? published.toJSON() : null,
    versions,
    attempts,
    problems: variantProblems(loaded),
  };
}

router.get('/tests', async (req, res) => {
  const where = { bank: 'simulation' };
  if (req.editorScope) where.id = [...req.editorScope.subjects];
  const subjects = await Subject.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
  const ids = subjects.map((s) => s.id);
  const [variants, topics] = await Promise.all([
    ids.length ? SimVariant.findAll({ where: { subjectId: ids }, attributes: ['id', 'subjectId', 'status'] }) : [],
    ids.length ? SimTopic.findAll({ where: { subjectId: ids }, attributes: ['id', 'subjectId'] }) : [],
  ]);
  res.json({
    tests: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      trackGroup: s.trackGroup,
      language: s.language,
      isExtra: !!s.isExtra,
      isActive: s.isActive,
      variants: variants.filter((v) => v.subjectId === s.id).length,
      published: variants.filter((v) => v.subjectId === s.id && v.status === 'published').length,
      topics: topics.filter((t) => t.subjectId === s.id).length,
    })),
  });
});

function testPatch(body) {
  const patch = {};
  if (body.name !== undefined) patch.name = cleanName(body.name);
  if (body.trackGroup !== undefined && TRACKS.includes(body.trackGroup)) patch.trackGroup = body.trackGroup;
  if (body.language !== undefined) patch.language = ['ru', 'ky', 'en', 'any'].includes(body.language) ? body.language : 'any';
  if (body.isExtra !== undefined) patch.isExtra = !!body.isExtra;
  if (body.isActive !== undefined) patch.isActive = !!body.isActive;
  return patch;
}

router.post('/tests', async (req, res) => {
  const patch = testPatch(req.body || {});
  if (!patch.name) return res.status(400).json({ error: 'Название обязательно' });
  if (!patch.trackGroup) return res.status(400).json({ error: 'Выберите вид теста' });
  const subject = await Subject.create({
    language: 'any',
    ...patch,
    bank: 'simulation',
    sortOrder: await nextOrder(Subject, { bank: 'simulation' }),
  });
  res.json({ test: subject });
});

router.put('/tests/:id', async (req, res) => {
  const subject = await simSubject(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Тест не найден' });
  const patch = testPatch(req.body || {});
  if (patch.name === '') return res.status(400).json({ error: 'Название обязательно' });
  await subject.update(patch);
  res.json({ test: subject });
});

router.delete('/tests/:id', async (req, res) => {
  const subject = await simSubject(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Тест не найден' });
  const variants = await SimVariant.findAll({ where: { subjectId: subject.id }, attributes: ['id'] });
  await destroyVariants(variants.map((v) => v.id));
  await SimTopic.destroy({ where: { subjectId: subject.id } });
  await subject.destroy();
  res.json({ ok: true });
});

router.get('/tests/:id', async (req, res) => {
  const subject = await simSubject(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Тест не найден' });
  const [variants, topics] = await Promise.all([
    SimVariant.findAll({ where: { subjectId: subject.id }, order: [['number', 'ASC'], ['id', 'ASC']] }),
    SimTopic.findAll({ where: { subjectId: subject.id } }),
  ]);
  const rows = [];
  for (const variant of variants) {
    const loaded = await loadVariantTree(variant.id);
    const json = treeJson(loaded);
    rows.push({ ...json.variant, totals: json.totals, problems: variantProblems(loaded).length });
  }
  const usage = await Test.findAll({
    where: { simTopicId: topics.map((t) => t.id).length ? topics.map((t) => t.id) : [0] },
    attributes: ['simTopicId'],
  });
  res.json({
    test: {
      id: subject.id,
      name: subject.name,
      trackGroup: subject.trackGroup,
      language: subject.language,
      isExtra: !!subject.isExtra,
      isActive: subject.isActive,
    },
    variants: rows,
    topics: topics.sort(byOrder).map((t) => ({
      id: t.id,
      name: t.name,
      used: usage.filter((u) => u.simTopicId === t.id).length,
    })),
  });
});

router.post('/tests/:id/topics', async (req, res) => {
  const subject = await simSubject(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Тест не найден' });
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Название темы обязательно' });
  const clash = await SimTopic.findOne({ where: { subjectId: subject.id, name: { [Op.iLike]: name } } });
  if (clash) return res.status(409).json({ error: 'Такая тема уже есть в справочнике' });
  const topic = await SimTopic.create({ subjectId: subject.id, name, sortOrder: await nextOrder(SimTopic, { subjectId: subject.id }) });
  res.json({ topic });
});

router.put('/topics/:id', async (req, res) => {
  const topic = await SimTopic.findByPk(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Название темы обязательно' });
  await topic.update({ name });
  await Test.update({ name }, { where: { simTopicId: topic.id } });
  res.json({ topic });
});

router.delete('/topics/:id', async (req, res) => {
  const topic = await SimTopic.findByPk(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
  if (await Test.count({ where: { simTopicId: topic.id } })) {
    return res.status(400).json({ error: 'Тема используется в вариантах — сначала уберите её из частей' });
  }
  await topic.destroy();
  res.json({ ok: true });
});

router.post('/tests/:id/variants', async (req, res) => {
  const subject = await simSubject(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Тест не найден' });
  const difficulty = DIFFICULTIES.includes(req.body?.difficulty) ? req.body.difficulty : 'medium';
  const number = positiveInt(req.body?.number)
    || ((await SimVariant.max('number', { where: { subjectId: subject.id } })) || 0) + 1;
  if (await SimVariant.count({ where: { subjectId: subject.id, number } })) {
    return res.status(409).json({ error: `Вариант №${number} уже есть` });
  }
  const variant = await SimVariant.create({ subjectId: subject.id, number, difficulty, status: 'draft' });
  await createFromTemplate(variant, subject);
  res.json({ variant: await variantJson(variant.id) });
});

router.get('/variants/:id', async (req, res) => {
  const json = await variantJson(req.params.id);
  if (!json) return res.status(404).json({ error: 'Вариант не найден' });
  res.json(json);
});

router.put('/variants/:id', async (req, res) => {
  const variant = await SimVariant.findByPk(req.params.id);
  if (!variant) return res.status(404).json({ error: 'Вариант не найден' });
  const patch = {};
  if (req.body?.difficulty !== undefined) {
    if (!DIFFICULTIES.includes(req.body.difficulty)) return res.status(400).json({ error: 'Неизвестный уровень сложности' });
    patch.difficulty = req.body.difficulty;
  }
  if (req.body?.number !== undefined) {
    const number = positiveInt(req.body.number);
    if (!number) return res.status(400).json({ error: 'Номер варианта — целое число больше 0' });
    const clash = await SimVariant.findOne({ where: { subjectId: variant.subjectId, number, id: { [Op.ne]: variant.id } } });
    if (clash) return res.status(409).json({ error: `Вариант №${number} уже есть` });
    patch.number = number;
  }
  if (req.body?.allowRetake !== undefined) patch.allowRetake = !!req.body.allowRetake;
  await variant.update(patch);
  res.json({ variant: await variantJson(variant.id) });
});

router.delete('/variants/:id', async (req, res) => {
  await destroyVariants([Number(req.params.id)]);
  res.json({ ok: true });
});

router.post('/variants/:id/publish', async (req, res) => {
  const out = await publishVariant(Number(req.params.id));
  if (out.error) return res.status(404).json({ error: out.error });
  if (out.problems) return res.status(400).json({ error: 'Вариант не готов к публикации', problems: out.problems });
  res.json({ variant: await variantJson(req.params.id) });
});

router.post('/variants/:id/unpublish', async (req, res) => {
  const variant = await SimVariant.findByPk(req.params.id);
  if (!variant) return res.status(404).json({ error: 'Вариант не найден' });
  await variant.update({ status: 'draft' });
  res.json({ variant: await variantJson(variant.id) });
});

router.post('/variants/:id/blocks', async (req, res) => {
  const variant = await SimVariant.findByPk(req.params.id);
  if (!variant) return res.status(404).json({ error: 'Вариант не найден' });
  const title = cleanName(req.body?.title);
  const minutes = positiveInt(req.body?.minutes);
  if (!title) return res.status(400).json({ error: 'Название блока обязательно' });
  if (!minutes) return res.status(400).json({ error: 'Время блока — целое число минут' });
  const block = await SimBlock.create({ variantId: variant.id, title, minutes, sortOrder: await nextOrder(SimBlock, { variantId: variant.id }) });
  const count = positiveInt(req.body?.count);
  if (count) {
    const format = SIM_FORMATS.includes(req.body?.format) ? req.body.format : 'standard';
    await createPart(block, variant.subjectId, { name: title, format, count });
  }
  res.json({ variant: await variantJson(variant.id) });
});

router.put('/blocks/:id', async (req, res) => {
  const block = await SimBlock.findByPk(req.params.id);
  if (!block) return res.status(404).json({ error: 'Блок не найден' });
  const patch = {};
  if (req.body?.title !== undefined) {
    patch.title = cleanName(req.body.title);
    if (!patch.title) return res.status(400).json({ error: 'Название блока обязательно' });
  }
  if (req.body?.minutes !== undefined) {
    patch.minutes = positiveInt(req.body.minutes);
    if (!patch.minutes) return res.status(400).json({ error: 'Время блока — целое число минут' });
  }
  await block.update(patch);
  res.json({ variant: await variantJson(block.variantId) });
});

router.delete('/blocks/:id', async (req, res) => {
  const block = await SimBlock.findByPk(req.params.id);
  if (!block) return res.status(404).json({ error: 'Блок не найден' });
  await destroyBlocks([block.id]);
  res.json({ variant: await variantJson(block.variantId) });
});

async function partWithVariant(id) {
  const part = await Test.findOne({ where: { id, bank: 'simulation', simBlockId: { [Op.ne]: null } } });
  if (!part) return null;
  const block = await SimBlock.findByPk(part.simBlockId);
  return block ? { part, block } : null;
}

router.post('/blocks/:id/parts', async (req, res) => {
  const block = await SimBlock.findByPk(req.params.id);
  if (!block) return res.status(404).json({ error: 'Блок не найден' });
  const variant = await SimVariant.findByPk(block.variantId);
  const name = cleanName(req.body?.name);
  const count = positiveInt(req.body?.requiredCount);
  const format = SIM_FORMATS.includes(req.body?.format) ? req.body.format : null;
  if (!name) return res.status(400).json({ error: 'Название части обязательно' });
  if (!count) return res.status(400).json({ error: 'Укажите число вопросов' });
  if (!format) return res.status(400).json({ error: 'Выберите формат вопросов' });
  await createPart(block, variant.subjectId, { name, format, count });
  res.json({ variant: await variantJson(block.variantId) });
});

router.put('/parts/:id', async (req, res) => {
  const found = await partWithVariant(req.params.id);
  if (!found) return res.status(404).json({ error: 'Часть не найдена' });
  const { part, block } = found;
  const patch = {};
  if (req.body?.name !== undefined) {
    patch.name = cleanName(req.body.name);
    if (!patch.name) return res.status(400).json({ error: 'Название части обязательно' });
  }
  if (req.body?.requiredCount !== undefined) {
    patch.requiredCount = positiveInt(req.body.requiredCount);
    if (!patch.requiredCount) return res.status(400).json({ error: 'Укажите число вопросов' });
  }
  if (req.body?.format !== undefined && req.body.format !== part.simFormat) {
    if (!SIM_FORMATS.includes(req.body.format)) return res.status(400).json({ error: 'Неизвестный формат' });
    const slots = await Test.findAll({ where: { parentId: part.id }, attributes: ['id'] });
    const ids = [part.id, ...slots.map((s) => s.id)];
    const filled = await Question.count({ where: { testId: ids } }) + await ReadingPassage.count({ where: { testId: ids } });
    if (filled) return res.status(400).json({ error: 'В части уже есть вопросы — формат менять нельзя' });
    patch.simFormat = req.body.format;
    if (part.kind !== 'group') patch.kind = req.body.format;
    if (slots.length) await Test.update({ kind: req.body.format }, { where: { parentId: part.id } });
  }
  await part.update(patch);
  res.json({ variant: await variantJson(block.variantId) });
});

router.delete('/parts/:id', async (req, res) => {
  const found = await partWithVariant(req.params.id);
  if (!found) return res.status(404).json({ error: 'Часть не найдена' });
  await destroyParts([found.part.id]);
  res.json({ variant: await variantJson(found.block.variantId) });
});

router.post('/parts/:id/topics', async (req, res) => {
  const found = await partWithVariant(req.params.id);
  if (!found) return res.status(404).json({ error: 'Часть не найдена' });
  const { part, block } = found;
  const topic = await SimTopic.findOne({ where: { id: req.body?.topicId, subjectId: part.subjectId } });
  if (!topic) return res.status(404).json({ error: 'Тема не найдена в справочнике' });
  if (await Test.count({ where: { parentId: part.id, simTopicId: topic.id } })) {
    return res.status(409).json({ error: 'Эта тема уже есть в части' });
  }
  if (part.kind !== 'group') {
    const own = await Question.count({ where: { testId: part.id } }) + await ReadingPassage.count({ where: { testId: part.id } });
    if (own) return res.status(400).json({ error: 'В части уже есть вопросы без темы — удалите их или оставьте часть без тем' });
    await part.update({ kind: 'group' });
  }
  await Test.create({
    name: topic.name,
    subjectId: part.subjectId,
    bank: 'simulation',
    parentId: part.id,
    kind: part.simFormat,
    simTopicId: topic.id,
    hasExplanations: true,
    isActive: true,
    sortOrder: await nextOrder(Test, { parentId: part.id }),
  });
  res.json({ variant: await variantJson(block.variantId) });
});

async function slotContext(id) {
  const slot = await Test.findOne({ where: { id, bank: 'simulation' } });
  if (!slot) return null;
  const part = slot.parentId ? await Test.findByPk(slot.parentId) : slot;
  if (!part?.simBlockId) return null;
  const block = await SimBlock.findByPk(part.simBlockId);
  const variant = block ? await SimVariant.findByPk(block.variantId) : null;
  const subject = variant ? await Subject.findByPk(variant.subjectId) : null;
  if (!subject) return null;
  return { slot, part, block, variant, subject };
}

router.get('/slots/:id', async (req, res) => {
  const ctx = await slotContext(req.params.id);
  if (!ctx) return res.status(404).json({ error: 'Раздел не найден' });
  const { slot, part, block, variant, subject } = ctx;
  const isPart = slot.id === part.id;
  const topicSlots = await Test.findAll({ where: { parentId: part.id }, attributes: ['id'] });
  const partCount = await Question.count({ where: { testId: [part.id, ...topicSlots.map((s) => s.id)], isActive: true } });
  res.json({
    slot: {
      id: slot.id,
      name: slot.name,
      kind: slot.kind,
      format: part.simFormat,
      isPart,
      hasTopics: isPart && topicSlots.length > 0,
    },
    part: { id: part.id, name: part.name, requiredCount: part.requiredCount, count: partCount },
    block: { id: block.id, title: block.title, minutes: block.minutes },
    variant: { id: variant.id, number: variant.number, status: variant.status },
    subject: { id: subject.id, name: subject.name },
  });
});

router.delete('/slots/:id', async (req, res) => {
  const ctx = await slotContext(req.params.id);
  if (!ctx || ctx.slot.id === ctx.part.id) return res.status(404).json({ error: 'Тема не найдена' });
  await destroySlots([ctx.slot.id]);
  if (!await Test.count({ where: { parentId: ctx.part.id } })) await ctx.part.update({ kind: ctx.part.simFormat });
  res.json({ variant: await variantJson(ctx.variant.id) });
});

const MOVABLE = {
  blocks: { find: (id) => SimBlock.findByPk(id), siblings: (row) => SimBlock.findAll({ where: { variantId: row.variantId } }), variantOf: async (row) => row.variantId },
  parts: {
    find: (id) => Test.findOne({ where: { id, bank: 'simulation', simBlockId: { [Op.ne]: null } } }),
    siblings: (row) => Test.findAll({ where: { simBlockId: row.simBlockId } }),
    variantOf: async (row) => (await SimBlock.findByPk(row.simBlockId))?.variantId,
  },
  slots: {
    find: (id) => Test.findOne({ where: { id, bank: 'simulation', simTopicId: { [Op.ne]: null } } }),
    siblings: (row) => Test.findAll({ where: { parentId: row.parentId } }),
    variantOf: async (row) => (await slotContext(row.id))?.variant.id,
  },
};

router.post('/:type/:id/move', async (req, res) => {
  const spec = MOVABLE[req.params.type];
  if (!spec) return res.status(404).json({ error: 'Не найдено' });
  const row = await spec.find(req.params.id);
  if (!row) return res.status(404).json({ error: 'Не найдено' });
  const list = (await spec.siblings(row)).sort(byOrder);
  const from = list.findIndex((item) => item.id === row.id);
  const to = from + (req.body?.dir === 'up' ? -1 : 1);
  if (to >= 0 && to < list.length) {
    [list[from], list[to]] = [list[to], list[from]];
    for (const [index, item] of list.entries()) {
      if (item.sortOrder !== index + 1) await item.update({ sortOrder: index + 1 });
    }
  }
  res.json({ variant: await variantJson(await spec.variantOf(row)) });
});

module.exports = router;

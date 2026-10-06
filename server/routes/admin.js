const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const {
  User,
  Subject,
  Test,
  Question,
  Answer,
  QuestionTag,
  QuestionTagMap,
  Flashcard,
  FlashcardTagMap,
  TermImage,
  SubscriptionPlan,
  Payment,
  TestResult,
  ChatMessage,
  ReadingPassage,
  ReadingPassageTagMap,
  PromoCode,
  sequelize,
} = require('../models');
const { normalizeCode, reservedCount } = require('../utils/promoCodes');
const { addCoins } = require('../utils/coins');
const {
  COMPARE_KIND,
  compareAnswers,
  compareCorrectIndex,
  isCompare,
} = require('../utils/compareQuestions');
const { publicMessage } = require('./chat');
const { inferOrtPart, normalizeOrtPart } = require('../utils/ortScoring');
const { normalizeKind, requiresImage } = require('../utils/sectionKinds');
const { findOrCreateTag } = require('../utils/findOrCreateTag');
const { publicQuestionWithCorrect, parseLinkedText, encodeLinkedText } = require('../utils/ortLinkedQuestions');
const txtUpload = require('./txtUpload');
const { ensurePlansForOrt } = require('../utils/subscriptionPlans');
const {
  destroyPassageTags,
} = require('../utils/passageTags');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const router = express.Router();

router.use(txtUpload);

router.get('/ort-stats', async (req, res) => {
  const now = new Date();
  const student = { role: 'student' };
  const [
    users,
    activeSubs,
    expired,
    everSubscribed,
    paid,
    revenue,
    subjects,
    tests,
    questions,
    flashcards,
    results,
    recentUsers,
  ] = await Promise.all([
    User.count({ where: student }),
    User.count({ where: { ...student, subscriptionEndDate: { [Op.gt]: now } } }),
    User.count({ where: { ...student, subscriptionEndDate: { [Op.lte]: now } } }),
    User.count({ where: { ...student, subscriptionEndDate: { [Op.ne]: null } } }),
    Payment.count({ where: { status: 'paid' } }),
    Payment.sum('amount', { where: { status: 'paid' } }),
    Subject.count(),
    Test.count(),
    Question.count(),
    Flashcard.count(),
    TestResult.count(),
    User.findAll({
      where: student,
      attributes: { exclude: ['passwordHash'] },
      order: [['id', 'DESC']],
      limit: 8,
    }),
  ]);
  res.json({
    users,
    activeSubs,
    expired,
    everSubscribed,
    paid,
    revenue: Number(revenue || 0),
    subjects,
    tests,
    questions,
    flashcards,
    results,
    recentUsers,
  });
});

router.get('/ort-subscription-plans', async (req, res) => {
  await ensurePlansForOrt();
  const plans = await SubscriptionPlan.findAll({ order: [['sortOrder', 'ASC']] });
  res.json({ plans });
});

function normalizePlan(item, index) {
  const title = String(item.title || '').trim();
  const months = Math.round(Number(item.months));
  const price = Math.round(Number(item.price));
  const oldRaw = item.oldPrice;
  const oldPrice = oldRaw === '' || oldRaw == null || oldRaw === 0
    ? null
    : Math.round(Number(oldRaw));
  if (!title) throw new Error('Название тарифа обязательно');
  if (!Number.isFinite(months) || months < 1) throw new Error('Срок должен быть от 1 месяца');
  if (!Number.isFinite(price) || price < 1) throw new Error('Цена должна быть больше 0');
  if (oldPrice != null && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
    throw new Error('Старая цена указана неверно');
  }
  return {
    title,
    months,
    price,
    oldPrice,
    isActive: item.isActive !== false,
    sortOrder: Math.round(Number(item.sortOrder)) || index + 1,
  };
}

router.put('/ort-subscription-plans', async (req, res) => {
  const items = req.body.plans || [];
  const saved = [];
  try {
    for (const [index, item] of items.entries()) {
      const patch = normalizePlan(item, index);
      if (item.id) {
        const plan = await SubscriptionPlan.findByPk(item.id);
        if (plan) {
          await plan.update(patch);
          saved.push(plan);
        }
      } else {
        saved.push(await SubscriptionPlan.create(patch));
      }
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  res.json({ plans: saved });
});

function parseDate(value) {
  if (value === '' || value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Дата указана неверно');
  return date;
}

function normalizePromoBody(body) {
  const code = normalizeCode(body.code);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    throw new Error('Код: от 3 до 40 символов — латинские буквы, цифры, «-» или «_»');
  }
  const discountType = body.discountType === 'fixed' ? 'fixed' : 'percent';
  const discountValue = Math.round(Number(body.discountValue));
  if (!Number.isFinite(discountValue) || discountValue < 1) throw new Error('Укажите размер скидки');
  if (discountType === 'percent' && discountValue > 100) throw new Error('Скидка не может быть больше 100%');
  const startsAt = parseDate(body.startsAt);
  const endsAt = parseDate(body.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) throw new Error('Дата окончания раньше даты начала');
  const maxRaw = body.maxUses;
  const maxUses = maxRaw === '' || maxRaw == null ? null : Math.round(Number(maxRaw));
  if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    throw new Error('Количество использований должно быть от 1');
  }
  const planIds = Array.isArray(body.planIds)
    ? [...new Set(body.planIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
  return {
    code,
    discountType,
    discountValue,
    startsAt,
    endsAt,
    maxUses,
    planIds: planIds.length ? planIds : null,
    isActive: body.isActive !== false,
    note: String(body.note || '').trim().slice(0, 300) || null,
  };
}

async function promoRow(promo) {
  const [reserved, paidStats] = await Promise.all([
    reservedCount(promo),
    Payment.findOne({
      where: { promoCodeId: promo.id, status: 'paid' },
      attributes: [
        [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('amount')), 0), 'revenue'],
        [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('discount')), 0), 'discounted'],
      ],
      raw: true,
    }),
  ]);
  return {
    ...promo.toJSON(),
    reserved,
    revenue: Number(paidStats?.revenue || 0),
    discounted: Number(paidStats?.discounted || 0),
  };
}

async function savePromo(res, promo, body) {
  let patch;
  try {
    patch = normalizePromoBody(body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const clash = await PromoCode.findOne({ where: { code: patch.code } });
  if (clash && (!promo || clash.id !== promo.id)) {
    return res.status(409).json({ error: 'Такой промокод уже есть' });
  }
  const saved = promo ? await promo.update(patch) : await PromoCode.create(patch);
  return res.json({ promo: await promoRow(saved) });
}

router.get('/promo-codes', async (req, res) => {
  const promos = await PromoCode.findAll({ order: [['id', 'DESC']] });
  res.json({ promos: await Promise.all(promos.map(promoRow)) });
});

router.post('/promo-codes', async (req, res) => savePromo(res, null, req.body || {}));

router.put('/promo-codes/:id', async (req, res) => {
  const promo = await PromoCode.findByPk(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Промокод не найден' });
  return savePromo(res, promo, req.body || {});
});

router.delete('/promo-codes/:id', async (req, res) => {
  await PromoCode.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/term-images', async (req, res) => {
  const items = await TermImage.findAll({ order: [['title', 'ASC']] });
  res.json({ items });
});

router.post('/term-images', upload.single('image'), async (req, res) => {
  let imageUrl = req.body.imageUrl;
  if (req.file) imageUrl = `/uploads/${req.file.filename}`;
  if (!imageUrl || !req.body.title) {
    return res.status(400).json({ error: 'title и image обязательны' });
  }
  const keywords = Array.isArray(req.body.keywords)
    ? req.body.keywords
    : String(req.body.keywords || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const item = await TermImage.create({
    title: req.body.title,
    description: req.body.description || '',
    imageUrl,
    keywords,
  });
  res.json({ item });
});

router.delete('/term-images/:id', async (req, res) => {
  await TermImage.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/subjects', async (req, res) => {
  const where = {};
  if (req.query.trackGroup) where.trackGroup = req.query.trackGroup;
  const subjects = await Subject.findAll({
    where,
    include: [
      {
        model: Test,
        attributes: ['id', 'name', 'sortOrder', 'ortPart', 'parentId', 'kind'],
        separate: true,
        order: [['sortOrder', 'ASC'], ['id', 'ASC']],
        include: [
          { model: Question, attributes: ['id'] },
          { model: ReadingPassage, attributes: ['id'] },
        ],
      },
    ],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  res.json({
    subjects: subjects.map((row) => {
      const subject = row.toJSON();
      subject.sections = (subject.Tests || []).map((test) => {
        const { Questions, ReadingPassages, ...rest } = test;
        return {
          ...rest,
          questionCount: (Questions || []).length,
          passageCount: (ReadingPassages || []).length,
        };
      });
      delete subject.Tests;
      subject.testCount = subject.sections.filter((test) => test.kind !== 'group').length;
      subject.questionCount = subject.sections.reduce((sum, test) => sum + test.questionCount, 0);
      return subject;
    }),
  });
});

router.post('/subjects', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Название обязательно' });
  const subject = await Subject.create({
    name,
    description: req.body.description || '',
    trackGroup: req.body.trackGroup || 'main',
    language: req.body.language || 'ru',
    sortOrder: req.body.sortOrder || 0,
    isActive: req.body.isActive !== false,
  });
  res.json({ subject });
});

router.put('/subjects/:id', async (req, res) => {
  const subject = await Subject.findByPk(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Предмет не найден' });
  const patch = { ...req.body };
  if (patch.name != null) {
    patch.name = String(patch.name).trim();
    if (!patch.name) return res.status(400).json({ error: 'Название обязательно' });
  }
  await subject.update(patch);
  res.json({ subject });
});

router.delete('/subjects/:id', async (req, res) => {
  const tests = await Test.findAll({ where: { subjectId: req.params.id } });
  for (const test of tests) {
    const questions = await Question.findAll({ where: { testId: test.id } });
    for (const q of questions) {
      await Answer.destroy({ where: { questionId: q.id } });
      await QuestionTagMap.destroy({ where: { questionId: q.id } });
    }
    await Question.destroy({ where: { testId: test.id } });
    await destroyPassageTags({ testId: test.id });
    await ReadingPassage.destroy({ where: { testId: test.id } });
  }
  await Test.destroy({ where: { subjectId: req.params.id } });
  const tags = await QuestionTag.findAll({ where: { subjectId: req.params.id } });
  for (const tag of tags) {
    await QuestionTagMap.destroy({ where: { tagId: tag.id } });
    await FlashcardTagMap.destroy({ where: { tagId: tag.id } });
    await ReadingPassageTagMap.destroy({ where: { tagId: tag.id } });
  }
  await QuestionTag.destroy({ where: { subjectId: req.params.id } });
  await Subject.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/tests', async (req, res) => {
  const where = {};
  if (req.query.subjectId) where.subjectId = req.query.subjectId;
  const tests = await Test.findAll({
    where,
    include: [Subject, { model: Question, attributes: ['id'] }],
    order: [['sortOrder', 'ASC']],
  });
  res.json({
    tests: tests.map((row) => {
      const test = row.toJSON();
      test.questionCount = (test.Questions || []).length;
      delete test.Questions;
      return test;
    }),
  });
});

const GROUP_HAS_NO_QUESTIONS = 'В разделе-группе нет вопросов — добавьте их в подраздел';
const GEOMETRY_NEEDS_IMAGE = 'В геометрии к вопросу нужен рисунок';

async function descendantIds(testId) {
  const ids = [];
  let frontier = [Number(testId)];
  while (frontier.length) {
    const children = await Test.findAll({ where: { parentId: frontier }, attributes: ['id'] });
    frontier = children.map((row) => row.id).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

async function hasContent(testId) {
  const [questions, passages] = await Promise.all([
    Question.count({ where: { testId } }),
    ReadingPassage.count({ where: { testId } }),
  ]);
  return questions + passages > 0;
}

router.post('/tests', async (req, res) => {
  const name = String(req.body.name || '').trim();
  let subjectId = Number(req.body.subjectId);
  const parentId = Number(req.body.parentId) || null;
  if (!name) return res.status(400).json({ error: 'Название обязательно' });
  let parent = null;
  if (parentId) {
    parent = await Test.findByPk(parentId);
    if (!parent) return res.status(404).json({ error: 'Родительский раздел не найден' });
    if (parent.kind !== 'group') {
      return res.status(400).json({ error: 'Подразделы можно добавлять только в раздел-группу' });
    }
    subjectId = parent.subjectId;
  }
  if (!subjectId) return res.status(400).json({ error: 'Укажите предмет' });
  const kind = normalizeKind(req.body.kind) || 'standard';
  const test = await Test.create({
    name,
    description: req.body.description || '',
    subjectId,
    parentId,
    kind,
    hasExplanations: req.body.hasExplanations !== false,
    isActive: req.body.isActive !== false,
    sortOrder: req.body.sortOrder || 0,
    ortPart: parent ? parent.ortPart : (normalizeOrtPart(req.body.ortPart) || inferOrtPart(name)),
  });
  res.json({ test });
});

router.put('/tests/:id', async (req, res) => {
  const test = await Test.findByPk(req.params.id);
  if (!test) return res.status(404).json({ error: 'Тест не найден' });
  const patch = {};
  for (const key of ['description', 'hasExplanations', 'isActive', 'sortOrder']) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  if (req.body.name != null) {
    patch.name = String(req.body.name).trim();
    if (!patch.name) return res.status(400).json({ error: 'Название обязательно' });
  }
  if (req.body.kind !== undefined) {
    const kind = normalizeKind(req.body.kind);
    if (!kind) return res.status(400).json({ error: 'Неизвестный тип раздела' });
    if (kind !== test.kind) {
      if (kind === 'group' && await hasContent(test.id)) {
        return res.status(400).json({ error: 'В разделе есть вопросы — сначала удалите или перенесите их' });
      }
      if (test.kind === 'group' && (await descendantIds(test.id)).length) {
        return res.status(400).json({ error: 'В разделе есть подразделы — сначала удалите их' });
      }
    }
    patch.kind = kind;
  }
  if (req.body.ortPart !== undefined && !test.parentId) {
    patch.ortPart = normalizeOrtPart(req.body.ortPart);
  }
  const prevOrtPart = test.ortPart;
  await test.update(patch);
  if (patch.ortPart !== undefined && patch.ortPart !== prevOrtPart) {
    const ids = await descendantIds(test.id);
    if (ids.length) await Test.update({ ortPart: patch.ortPart }, { where: { id: ids } });
  }
  res.json({ test });
});

router.delete('/tests/:id', async (req, res) => {
  const ids = [Number(req.params.id), ...await descendantIds(req.params.id)];
  await destroyQuestions({ testId: ids });
  await destroyPassageTags({ testId: ids });
  await ReadingPassage.destroy({ where: { testId: ids } });
  await Test.destroy({ where: { id: ids } });
  res.json({ ok: true });
});

function cleanPassageBody(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function passagePayload(body) {
  return {
    title: String(body.title || '').trim(),
    subtitle: String(body.subtitle || '').trim() || null,
    body: cleanPassageBody(body.body),
  };
}

async function destroyQuestions(where) {
  const questions = await Question.findAll({ where, attributes: ['id'] });
  const ids = questions.map((q) => q.id);
  if (!ids.length) return;
  await Answer.destroy({ where: { questionId: ids } });
  await QuestionTagMap.destroy({ where: { questionId: ids } });
  await Question.destroy({ where: { id: ids } });
}

router.get('/reading-passages', async (req, res) => {
  const testId = Number(req.query.testId);
  if (!testId) return res.status(400).json({ error: 'testId обязателен' });
  const passages = await ReadingPassage.findAll({
    where: { testId },
    include: [{ model: Question, attributes: ['id'], required: false }],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  res.json({
    passages: passages.map((row) => {
      const p = row.toJSON();
      p.questionCount = (p.Questions || []).length;
      delete p.Questions;
      return p;
    }),
  });
});

async function passageById(id) {
  const row = await ReadingPassage.findByPk(id);
  return row ? row.toJSON() : null;
}

router.get('/reading-passages/:id', async (req, res) => {
  const passage = await passageById(req.params.id);
  if (!passage) return res.status(404).json({ error: 'Текст не найден' });
  const questions = await Question.findAll({
    where: { passageId: passage.id },
    include: [Answer],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Answer, 'sortOrder', 'ASC']],
  });
  res.json({ passage, questions: questions.map(publicQuestionWithCorrect) });
});

router.post('/reading-passages', async (req, res) => {
  const testId = Number(req.body.testId);
  const data = passagePayload(req.body || {});
  if (!testId) return res.status(400).json({ error: 'Укажите раздел' });
  const test = await Test.findByPk(testId);
  if (!test) return res.status(404).json({ error: 'Раздел не найден' });
  if (test.kind === 'group') return res.status(400).json({ error: GROUP_HAS_NO_QUESTIONS });
  if (!data.title) return res.status(400).json({ error: 'Название текста обязательно' });
  if (!data.body) return res.status(400).json({ error: 'Текст пустой' });
  const count = await ReadingPassage.count({ where: { testId } });
  const passage = await ReadingPassage.create({
    ...data,
    testId,
    sortOrder: Number(req.body.sortOrder) || count + 1,
    isActive: req.body.isActive !== false,
  });
  res.json({ passage: await passageById(passage.id) });
});

router.put('/reading-passages/:id', async (req, res) => {
  const passage = await ReadingPassage.findByPk(req.params.id);
  if (!passage) return res.status(404).json({ error: 'Текст не найден' });
  const data = passagePayload({ ...passage.toJSON(), ...req.body });
  if (!data.title) return res.status(400).json({ error: 'Название текста обязательно' });
  if (!data.body) return res.status(400).json({ error: 'Текст пустой' });
  await passage.update({
    ...data,
    sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) || 0 : passage.sortOrder,
    isActive: req.body.isActive ?? passage.isActive,
  });
  res.json({ passage: await passageById(passage.id) });
});

router.delete('/reading-passages/:id', async (req, res) => {
  await destroyQuestions({ passageId: req.params.id });
  await destroyPassageTags({ id: req.params.id });
  await ReadingPassage.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/questions', async (req, res) => {
  const where = {};
  if (req.query.testId) where.testId = req.query.testId;
  if (req.query.passageId) where.passageId = req.query.passageId;
  else where.passageId = null;
  const questions = await Question.findAll({
    where,
    include: [Answer],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  res.json({ questions: questions.map(publicQuestionWithCorrect) });
});

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function comparePayload(body, { requireCorrect = true } = {}) {
  const compareA = String(body.compareA ?? '').trim();
  const compareB = String(body.compareB ?? '').trim();
  if (!compareA || !compareB) return { error: 'Заполните обе колонки: А и Б' };
  const correct = body.correct == null || body.correct === '' ? null : compareCorrectIndex(body.correct);
  if (correct == null && (requireCorrect || body.correct != null)) {
    return { error: 'Выберите правильный ответ: А, Б, В или Г' };
  }
  return {
    fields: { kind: COMPARE_KIND, compareA, compareB, text: String(body.text ?? '').trim() },
    answers: correct == null ? null : compareAnswers(correct),
  };
}

router.post('/questions', async (req, res) => {
  let testId = Number(req.body.testId) || null;
  const passageId = Number(req.body.passageId) || null;
  if (passageId) {
    const passage = await ReadingPassage.findByPk(passageId);
    if (!passage) return res.status(404).json({ error: 'Текст не найден' });
    testId = passage.testId;
  }
  if (!testId) return res.status(400).json({ error: 'Укажите раздел' });
  const parentTest = await Test.findByPk(testId);
  if (!parentTest) return res.status(404).json({ error: 'Раздел не найден' });
  if (parentTest.kind === 'group') return res.status(400).json({ error: GROUP_HAS_NO_QUESTIONS });
  if (requiresImage(parentTest) && !optionalText(req.body.imageUrl)) {
    return res.status(400).json({ error: GEOMETRY_NEEDS_IMAGE });
  }
  let compare = null;
  if (isCompare(req.body)) {
    compare = comparePayload(req.body);
    if (compare.error) return res.status(400).json({ error: compare.error });
    req.body.answers = compare.answers;
  }
  const question = await Question.create({
    testId,
    passageId,
    ...(compare ? compare.fields : {}),
    text: compare ? compare.fields.text : req.body.text,
    imageUrl: optionalText(req.body.imageUrl),
    explanation: req.body.explanation || '',
    explanationImageUrl: optionalText(req.body.explanationImageUrl),
    evidence: optionalText(req.body.evidence),
    externalId: req.body.externalId || null,
    sortOrder: req.body.sortOrder || 0,
  });
  for (const [idx, answer] of (req.body.answers || []).entries()) {
    await Answer.create({
      questionId: question.id,
      text: answer.text,
      imageUrl: optionalText(answer.imageUrl),
      isCorrect: !!answer.isCorrect,
      sortOrder: answer.sortOrder ?? idx + 1,
    });
  }
  const full = await Question.findByPk(question.id, { include: [Answer] });
  res.json({ question: publicQuestionWithCorrect(full) });
});

router.put('/questions/:id', async (req, res) => {
  const question = await Question.findByPk(req.params.id);
  if (!question) return res.status(404).json({ error: 'Вопрос не найден' });
  let nextText = req.body.text ?? question.text;
  const linked = parseLinkedText(question.text);
  if (req.body.text != null && linked.groupId) {
    nextText = encodeLinkedText(linked.groupId, linked.role, String(req.body.text));
  }
  const patch = {
    text: nextText,
    explanation: req.body.explanation ?? question.explanation,
    isActive: req.body.isActive ?? question.isActive,
  };
  for (const key of ['imageUrl', 'explanationImageUrl', 'evidence']) {
    if (req.body[key] !== undefined) patch[key] = optionalText(req.body[key]);
  }
  if (req.body.sortOrder != null) patch.sortOrder = Number(req.body.sortOrder) || 0;
  if ('imageUrl' in patch && !patch.imageUrl && requiresImage(await Test.findByPk(question.testId))) {
    return res.status(400).json({ error: GEOMETRY_NEEDS_IMAGE });
  }
  if (isCompare(question) || isCompare(req.body)) {
    const compare = comparePayload({
      text: req.body.text ?? question.text,
      compareA: req.body.compareA ?? question.compareA,
      compareB: req.body.compareB ?? question.compareB,
      correct: req.body.correct,
    }, { requireCorrect: false });
    if (compare.error) return res.status(400).json({ error: compare.error });
    Object.assign(patch, compare.fields);
    req.body.answers = compare.answers || undefined;
  }
  await question.update(patch);
  if (Array.isArray(req.body.answers)) {
    await Answer.destroy({ where: { questionId: question.id } });
    for (const [idx, answer] of req.body.answers.entries()) {
      await Answer.create({
        questionId: question.id,
        text: answer.text,
        imageUrl: optionalText(answer.imageUrl),
        isCorrect: !!answer.isCorrect,
        sortOrder: answer.sortOrder ?? idx + 1,
      });
    }
  }
  const full = await Question.findByPk(question.id, { include: [Answer] });
  res.json({ question: publicQuestionWithCorrect(full) });
});

router.delete('/questions/:id', async (req, res) => {
  await Answer.destroy({ where: { questionId: req.params.id } });
  await QuestionTagMap.destroy({ where: { questionId: req.params.id } });
  await Question.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/flashcards', async (req, res) => {
  const where = {};
  if (req.query.testId) where.testId = req.query.testId;
  if (req.query.trackGroup) where.trackGroup = req.query.trackGroup;
  const include = [{ model: QuestionTag }];
  if (req.query.tagId) {
    include[0].where = { id: req.query.tagId };
    include[0].required = true;
  }
  const flashcards = await Flashcard.findAll({ where, include, order: [['id', 'DESC']] });
  res.json({ flashcards });
});

router.post('/flashcards', async (req, res) => {
  const card = await Flashcard.create({
    trackGroup: req.body.trackGroup || 'main',
    testId: req.body.testId || null,
    frontText: req.body.frontText,
    backText: req.body.backText,
    frontImageUrl: req.body.frontImageUrl || null,
    backImageUrl: req.body.backImageUrl || null,
    externalId: req.body.externalId || null,
  });
  if (req.body.topic) {
    const parentTest = card.testId ? await Test.findByPk(card.testId) : null;
    const tag = await findOrCreateTag(req.body.topic, 'topic', parentTest?.subjectId || null);
    if (tag) await FlashcardTagMap.create({ flashcardId: card.id, tagId: tag.id });
  }
  res.json({ flashcard: card });
});

router.put('/flashcards/:id', async (req, res) => {
  const card = await Flashcard.findByPk(req.params.id);
  if (!card) return res.status(404).json({ error: 'Карточка не найдена' });
  await card.update({
    frontText: req.body.frontText ?? card.frontText,
    backText: req.body.backText ?? card.backText,
    trackGroup: req.body.trackGroup ?? card.trackGroup,
    testId: req.body.testId === undefined ? card.testId : (req.body.testId || null),
    frontImageUrl: req.body.frontImageUrl === undefined ? card.frontImageUrl : req.body.frontImageUrl,
    backImageUrl: req.body.backImageUrl === undefined ? card.backImageUrl : req.body.backImageUrl,
    isActive: req.body.isActive ?? card.isActive,
  });
  if (req.body.topic !== undefined) {
    await FlashcardTagMap.destroy({ where: { flashcardId: card.id } });
    if (req.body.topic) {
      const parentTest = card.testId ? await Test.findByPk(card.testId) : null;
      const tag = await findOrCreateTag(req.body.topic, 'topic', parentTest?.subjectId || null);
      if (tag) await FlashcardTagMap.create({ flashcardId: card.id, tagId: tag.id });
    }
  }
  const full = await Flashcard.findByPk(card.id, { include: [QuestionTag] });
  res.json({ flashcard: full });
});

router.delete('/flashcards/:id', async (req, res) => {
  await FlashcardTagMap.destroy({ where: { flashcardId: req.params.id } });
  await Flashcard.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const where = { role: 'student' };
  if (q) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { login: { [Op.iLike]: `%${q}%` } },
      { email: { [Op.iLike]: `%${q}%` } },
    ];
  }
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['passwordHash'] },
    order: [['id', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ users: rows, total: count, page, limit });
});

router.get('/chat/threads', async (req, res) => {
  const unreadRows = await ChatMessage.count({
    where: { fromAdmin: false, readAt: null },
    group: ['userId'],
  });
  const unreadMap = Object.fromEntries(unreadRows.map((row) => [row.userId, Number(row.count)]));

  const lastIds = await ChatMessage.findAll({
    attributes: [[sequelize.fn('MAX', sequelize.col('id')), 'id']],
    group: ['userId'],
    raw: true,
  });
  const ids = lastIds.map((row) => row.id).filter(Boolean);
  const lastMessages = ids.length
    ? await ChatMessage.findAll({
      where: { id: ids },
      include: [{ model: User, attributes: ['id', 'name', 'login', 'email'] }],
      order: [['id', 'DESC']],
    })
    : [];

  res.json({
    threads: lastMessages.map((row) => ({
      userId: row.userId,
      user: row.User,
      lastText: row.text,
      lastAt: row.createdAt,
      lastFromAdmin: row.fromAdmin,
      unread: unreadMap[row.userId] || 0,
    })),
  });
});

router.get('/chat/threads/:userId', async (req, res) => {
  const user = await User.findByPk(req.params.userId, {
    attributes: ['id', 'name', 'login', 'email', 'role'],
  });
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Пользователь не найден' });
  await ChatMessage.update(
    { readAt: new Date() },
    { where: { userId: user.id, fromAdmin: false, readAt: null } },
  );
  const rows = await ChatMessage.findAll({
    where: { userId: user.id },
    order: [['id', 'ASC']],
    limit: 300,
  });
  res.json({
    user: { id: user.id, name: user.name, login: user.login, email: user.email },
    messages: rows.map(publicMessage),
  });
});

router.post('/chat/threads/:userId', async (req, res) => {
  const user = await User.findByPk(req.params.userId);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'Пользователь не найден' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Напишите сообщение' });
  if (text.length > 2000) return res.status(400).json({ error: 'Слишком длинное сообщение' });
  const row = await ChatMessage.create({
    userId: user.id,
    authorId: req.user.id,
    fromAdmin: true,
    text,
  });
  res.json({ message: publicMessage(row) });
});

router.post('/users/:id/coins', async (req, res) => {
  const amount = Math.round(Number(req.body.amount));
  if (!Number.isFinite(amount) || !amount || Math.abs(amount) > 100000) {
    return res.status(400).json({ error: 'Укажите количество монет' });
  }
  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role === 'admin') return null;
    const delta = Math.max(amount, -(user.coins || 0));
    await addCoins(user, delta, 'admin', { transaction });
    return user;
  });
  if (!result) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ coins: result.coins });
});

router.post('/users/:id/grant-subscription', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const months = Number(req.body.months) || 1;
  const base = user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()
    ? new Date(user.subscriptionEndDate)
    : new Date();
  base.setMonth(base.getMonth() + months);
  user.subscriptionEndDate = base;
  await user.save();
  res.json({ user });
});

module.exports = router;

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
} = require('../models');
const { slugify, normalizeTagName } = require('../utils/ortTagNormalize');
const { findOrCreateTag } = require('../utils/findOrCreateTag');
const { publicQuestionWithCorrect } = require('../utils/ortLinkedQuestions');
const txtUpload = require('./txtUpload');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const router = express.Router();

router.use(txtUpload);

async function mergeTagInto(sourceId, targetId) {
  const maps = await QuestionTagMap.findAll({ where: { tagId: sourceId } });
  for (const map of maps) {
    await QuestionTagMap.findOrCreate({
      where: { questionId: map.questionId, tagId: targetId },
      defaults: { questionId: map.questionId, tagId: targetId },
    });
  }
  const fmaps = await FlashcardTagMap.findAll({ where: { tagId: sourceId } });
  for (const map of fmaps) {
    await FlashcardTagMap.findOrCreate({
      where: { flashcardId: map.flashcardId, tagId: targetId },
      defaults: { flashcardId: map.flashcardId, tagId: targetId },
    });
  }
  await QuestionTagMap.destroy({ where: { tagId: sourceId } });
  await FlashcardTagMap.destroy({ where: { tagId: sourceId } });
  await QuestionTag.destroy({ where: { id: sourceId } });
}

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
  const plans = await SubscriptionPlan.findAll({ order: [['sortOrder', 'ASC']] });
  res.json({ plans });
});

router.put('/ort-subscription-plans', async (req, res) => {
  const items = req.body.plans || [];
  const saved = [];
  for (const item of items) {
    if (item.id) {
      const plan = await SubscriptionPlan.findByPk(item.id);
      if (plan) {
        await plan.update({
          title: item.title,
          months: item.months,
          price: item.price,
          oldPrice: item.oldPrice ?? null,
          isActive: item.isActive !== false,
          sortOrder: item.sortOrder || 0,
        });
        saved.push(plan);
      }
    } else {
      saved.push(await SubscriptionPlan.create(item));
    }
  }
  res.json({ plans: saved });
});

router.get('/question-tags', async (req, res) => {
  const where = {};
  if (req.query.subjectId) where.subjectId = req.query.subjectId;
  const tags = await QuestionTag.findAll({ where, order: [['name', 'ASC']] });
  res.json({ tags });
});

router.post('/question-tags', async (req, res) => {
  const name = normalizeTagName(req.body.name);
  if (!name) return res.status(400).json({ error: 'Название обязательно' });
  const subjectId = req.body.subjectId ? Number(req.body.subjectId) : null;
  if (!subjectId) return res.status(400).json({ error: 'Укажите предмет' });
  const tag = await findOrCreateTag(name, req.body.kind === 'skill' ? 'skill' : 'topic', subjectId);
  res.json({ tag });
});

router.put('/question-tags/:id', async (req, res) => {
  const tag = await QuestionTag.findByPk(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Тег не найден' });
  const name = normalizeTagName(req.body.name || tag.name);
  const subjectId = tag.subjectId;
  const slug = subjectId ? `${slugify(name)}-${subjectId}` : slugify(name);
  await tag.update({
    name,
    slug,
    kind: req.body.kind || tag.kind,
    isActive: req.body.isActive !== false,
  });
  res.json({ tag });
});

router.delete('/question-tags/:id', async (req, res) => {
  await QuestionTagMap.destroy({ where: { tagId: req.params.id } });
  await FlashcardTagMap.destroy({ where: { tagId: req.params.id } });
  await QuestionTag.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post('/question-tags/merge', async (req, res) => {
  const { sourceId, targetId } = req.body || {};
  if (!sourceId || !targetId || Number(sourceId) === Number(targetId)) {
    return res.status(400).json({ error: 'Укажите sourceId и targetId' });
  }
  await mergeTagInto(sourceId, targetId);
  res.json({ ok: true });
});

router.post('/question-tags/merge-duplicates', async (req, res) => {
  const tags = await QuestionTag.findAll({ order: [['id', 'ASC']] });
  const groups = new Map();
  for (const tag of tags) {
    const key = `${tag.kind}:${tag.slug}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tag);
  }
  let mergedTags = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keep, ...dupes] = group;
    for (const dupe of dupes) {
      await mergeTagInto(dupe.id, keep.id);
      mergedTags += 1;
    }
  }
  res.json({
    ok: true,
    mergedTags,
    message: mergedTags ? `Слито тегов: ${mergedTags}` : 'Совпадающих тегов нет',
  });
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
        attributes: ['id', 'name', 'sortOrder'],
        separate: true,
        order: [['sortOrder', 'ASC'], ['id', 'ASC']],
        include: [{ model: Question, attributes: ['id'] }],
      },
      { model: QuestionTag, attributes: ['id', 'name', 'kind'], separate: true, order: [['name', 'ASC']] },
    ],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  res.json({
    subjects: subjects.map((row) => {
      const subject = row.toJSON();
      subject.sections = (subject.Tests || []).map((test) => {
        const { Questions, ...rest } = test;
        return { ...rest, questionCount: (Questions || []).length };
      });
      subject.tags = subject.QuestionTags || [];
      subject.testCount = subject.sections.length;
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
  }
  await Test.destroy({ where: { subjectId: req.params.id } });
  const tags = await QuestionTag.findAll({ where: { subjectId: req.params.id } });
  for (const tag of tags) {
    await QuestionTagMap.destroy({ where: { tagId: tag.id } });
    await FlashcardTagMap.destroy({ where: { tagId: tag.id } });
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

router.post('/tests', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const subjectId = Number(req.body.subjectId);
  if (!name) return res.status(400).json({ error: 'Название обязательно' });
  if (!subjectId) return res.status(400).json({ error: 'Укажите предмет' });
  const test = await Test.create({
    name,
    description: req.body.description || '',
    subjectId,
    hasExplanations: req.body.hasExplanations !== false,
    isActive: req.body.isActive !== false,
    sortOrder: req.body.sortOrder || 0,
  });
  res.json({ test });
});

router.put('/tests/:id', async (req, res) => {
  const test = await Test.findByPk(req.params.id);
  if (!test) return res.status(404).json({ error: 'Тест не найден' });
  const patch = { ...req.body };
  if (patch.name != null) {
    patch.name = String(patch.name).trim();
    if (!patch.name) return res.status(400).json({ error: 'Название обязательно' });
  }
  await test.update(patch);
  res.json({ test });
});

router.delete('/tests/:id', async (req, res) => {
  const questions = await Question.findAll({ where: { testId: req.params.id } });
  for (const q of questions) {
    await Answer.destroy({ where: { questionId: q.id } });
    await QuestionTagMap.destroy({ where: { questionId: q.id } });
  }
  await Question.destroy({ where: { testId: req.params.id } });
  await Test.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/questions', async (req, res) => {
  const where = {};
  if (req.query.testId) where.testId = req.query.testId;
  const questions = await Question.findAll({
    where,
    include: [Answer, QuestionTag],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  res.json({ questions: questions.map(publicQuestionWithCorrect) });
});

router.post('/questions', async (req, res) => {
  const question = await Question.create({
    testId: req.body.testId,
    text: req.body.text,
    explanation: req.body.explanation || '',
    externalId: req.body.externalId || null,
    sortOrder: req.body.sortOrder || 0,
  });
  for (const [idx, answer] of (req.body.answers || []).entries()) {
    await Answer.create({
      questionId: question.id,
      text: answer.text,
      isCorrect: !!answer.isCorrect,
      sortOrder: answer.sortOrder ?? idx + 1,
    });
  }
  const parentTest = await Test.findByPk(question.testId);
  for (const tag of req.body.tags || []) {
    const row = await findOrCreateTag(tag.name, tag.kind || 'topic', parentTest?.subjectId || null);
    if (row) await QuestionTagMap.create({ questionId: question.id, tagId: row.id });
  }
  const full = await Question.findByPk(question.id, { include: [Answer, QuestionTag] });
  res.json({ question: publicQuestionWithCorrect(full) });
});

router.put('/questions/:id', async (req, res) => {
  const question = await Question.findByPk(req.params.id);
  if (!question) return res.status(404).json({ error: 'Вопрос не найден' });
  await question.update({
    text: req.body.text ?? question.text,
    explanation: req.body.explanation ?? question.explanation,
    isActive: req.body.isActive ?? question.isActive,
  });
  if (Array.isArray(req.body.answers)) {
    await Answer.destroy({ where: { questionId: question.id } });
    for (const [idx, answer] of req.body.answers.entries()) {
      await Answer.create({
        questionId: question.id,
        text: answer.text,
        isCorrect: !!answer.isCorrect,
        sortOrder: answer.sortOrder ?? idx + 1,
      });
    }
  }
  if (Array.isArray(req.body.tags)) {
    await QuestionTagMap.destroy({ where: { questionId: question.id } });
    const parentTest = await Test.findByPk(question.testId);
    for (const tag of req.body.tags) {
      const row = await findOrCreateTag(tag.name, tag.kind || 'topic', parentTest?.subjectId || null);
      if (row) {
        await QuestionTagMap.findOrCreate({
          where: { questionId: question.id, tagId: row.id },
          defaults: { questionId: question.id, tagId: row.id },
        });
      }
    }
  }
  const full = await Question.findByPk(question.id, { include: [Answer, QuestionTag] });
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

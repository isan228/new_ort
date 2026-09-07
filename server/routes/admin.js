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

router.get('/ort-stats', async (req, res) => {
  const now = new Date();
  const [users, activeSubs, paid, subjects, tests, questions, flashcards] = await Promise.all([
    User.count({ where: { role: 'student' } }),
    User.count({ where: { role: 'student', subscriptionEndDate: { [Op.gt]: now } } }),
    Payment.count({ where: { status: 'paid' } }),
    Subject.count(),
    Test.count(),
    Question.count(),
    Flashcard.count(),
  ]);
  res.json({ users, activeSubs, paid, subjects, tests, questions, flashcards });
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
  const tags = await QuestionTag.findAll({ order: [['kind', 'ASC'], ['name', 'ASC']] });
  res.json({ tags });
});

router.post('/question-tags', async (req, res) => {
  const name = normalizeTagName(req.body.name);
  const kind = req.body.kind === 'skill' ? 'skill' : 'topic';
  if (!name) return res.status(400).json({ error: 'Название обязательно' });
  const tag = await findOrCreateTag(name, kind);
  res.json({ tag });
});

router.put('/question-tags/:id', async (req, res) => {
  const tag = await QuestionTag.findByPk(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Тег не найден' });
  const name = normalizeTagName(req.body.name || tag.name);
  await tag.update({
    name,
    slug: slugify(name),
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
  if (!sourceId || !targetId || sourceId === targetId) {
    return res.status(400).json({ error: 'Укажите sourceId и targetId' });
  }
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
  const subjects = await Subject.findAll({
    include: [Test],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  res.json({ subjects });
});

router.post('/subjects', async (req, res) => {
  const subject = await Subject.create({
    name: req.body.name,
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
  await subject.update(req.body);
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
  await Subject.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/tests', async (req, res) => {
  const where = {};
  if (req.query.subjectId) where.subjectId = req.query.subjectId;
  const tests = await Test.findAll({ where, include: [Subject], order: [['sortOrder', 'ASC']] });
  res.json({ tests });
});

router.post('/tests', async (req, res) => {
  const test = await Test.create({
    name: req.body.name,
    description: req.body.description || '',
    subjectId: req.body.subjectId,
    hasExplanations: req.body.hasExplanations !== false,
    isActive: req.body.isActive !== false,
    sortOrder: req.body.sortOrder || 0,
  });
  res.json({ test });
});

router.put('/tests/:id', async (req, res) => {
  const test = await Test.findByPk(req.params.id);
  if (!test) return res.status(404).json({ error: 'Тест не найден' });
  await test.update(req.body);
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
  for (const tag of req.body.tags || []) {
    const row = await findOrCreateTag(tag.name, tag.kind || 'topic');
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
    const tag = await findOrCreateTag(req.body.topic, 'topic');
    if (tag) await FlashcardTagMap.create({ flashcardId: card.id, tagId: tag.id });
  }
  res.json({ flashcard: card });
});

router.delete('/flashcards/:id', async (req, res) => {
  await FlashcardTagMap.destroy({ where: { flashcardId: req.params.id } });
  await Flashcard.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/users', async (req, res) => {
  const users = await User.findAll({
    attributes: { exclude: ['passwordHash'] },
    order: [['id', 'DESC']],
    limit: 200,
  });
  res.json({ users });
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

const express = require('express');
const { Op } = require('sequelize');
const {
  Subject,
  Test,
  Question,
  Answer,
  QuestionTag,
  QuestionTagMap,
  Flashcard,
  TestResult,
} = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireOrtSubscription } = require('../middleware/requireOrtSubscription');
const {
  pickQuestionsKeepingLinkedOrder,
  publicQuestionShape,
  publicQuestionWithCorrect,
} = require('../utils/ortLinkedQuestions');

const router = express.Router();

router.use(requireAuth);

router.get('/subjects', async (req, res) => {
  const subjects = await Subject.findAll({
    where: { isActive: true },
    include: [{ model: Test, where: { isActive: true }, required: false }],
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  res.json({ subjects });
});

router.use('/ort', requireOrtSubscription);

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadQuestionsForTest(testId, extraWhere = {}) {
  return Question.findAll({
    where: { testId, isActive: true, ...extraWhere },
    include: [
      { model: Answer },
      { model: QuestionTag },
    ],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Answer, 'sortOrder', 'ASC']],
  });
}

router.get('/ort/dashboard', async (req, res) => {
  const subjects = await Subject.findAll({
    where: { isActive: true },
    include: [{ model: Test, where: { isActive: true }, required: false }],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Test, 'sortOrder', 'ASC']],
  });

  const grouped = { main: [], state_lang: [], subject: [] };
  for (const subject of subjects) {
    const bucket = grouped[subject.trackGroup] || grouped.subject;
    bucket.push(subject);
  }
  res.json(grouped);
});

router.get('/ort/welcome-stats', async (req, res) => {
  const testId = Number(req.query.testId);
  if (!testId) return res.status(400).json({ error: 'testId обязателен' });

  const totalQuestions = await Question.count({ where: { testId, isActive: true } });
  const results = await TestResult.findAll({
    where: { userId: req.user.id, testId },
    order: [['createdAt', 'DESC']],
  });

  const seen = new Set();
  const incorrect = new Set();
  let lastScore = null;
  for (const result of results) {
    if (lastScore === null && result.total) {
      lastScore = Math.round((result.score / result.total) * 100);
    }
    for (const item of result.answers || []) {
      if (item.questionId) seen.add(item.questionId);
      if (item.questionId && item.correct === false) incorrect.add(item.questionId);
    }
  }

  res.json({
    testId,
    totalQuestions,
    touched: seen.size,
    incorrect: incorrect.size,
    unsolved: Math.max(0, totalQuestions - seen.size),
    attempts: results.length,
    lastAccuracy: lastScore,
  });
});

router.get('/ort/history', async (req, res) => {
  const testId = Number(req.query.testId);
  if (!testId) return res.status(400).json({ error: 'testId обязателен' });
  const rows = await TestResult.findAll({
    where: { userId: req.user.id, testId },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.json({
    history: rows.map((r) => ({
      id: r.id,
      score: r.score,
      total: r.total,
      accuracy: r.total ? Math.round((r.score / r.total) * 100) : 0,
      questionMode: r.questionMode,
      durationSec: r.durationSec,
      createdAt: r.createdAt,
    })),
  });
});

router.get('/ort/tags', async (req, res) => {
  const tags = await QuestionTag.findAll({
    where: { isActive: true },
    order: [['kind', 'ASC'], ['name', 'ASC']],
  });
  res.json({ tags });
});

router.get('/ort/tags/grouped', async (req, res) => {
  const testId = Number(req.query.testId);
  if (!testId) return res.status(400).json({ error: 'testId обязателен' });

  const questions = await Question.findAll({
    where: { testId, isActive: true },
    include: [{ model: QuestionTag, where: { isActive: true }, required: false }],
  });

  const topicMap = new Map();
  const skillMap = new Map();
  for (const q of questions) {
    for (const tag of q.QuestionTags || []) {
      const target = tag.kind === 'skill' ? skillMap : topicMap;
      if (!target.has(tag.id)) target.set(tag.id, { ...tag.toJSON(), count: 0 });
      target.get(tag.id).count += 1;
    }
  }

  res.json({
    topics: [...topicMap.values()],
    skills: [...skillMap.values()],
  });
});

router.get('/ort/tests-by-tags', async (req, res) => {
  const tagIds = String(req.query.tagIds || '')
    .split(',')
    .map((x) => Number(x))
    .filter(Boolean);
  if (!tagIds.length) return res.json({ tests: [] });

  const maps = await QuestionTagMap.findAll({ where: { tagId: tagIds } });
  const questionIds = [...new Set(maps.map((m) => m.questionId))];
  const questions = await Question.findAll({ where: { id: questionIds, isActive: true } });
  const testIds = [...new Set(questions.map((q) => q.testId))];
  const tests = await Test.findAll({
    where: { id: testIds, isActive: true },
    include: [Subject],
  });
  res.json({ tests });
});

router.post('/ort/custom-test/questions', async (req, res) => {
  const {
    testId,
    topicTagIds = [],
    skillTagIds = [],
    questionCount = 20,
    questionMode = 'all',
    randomizeAnswers = true,
  } = req.body || {};

  if (!testId) return res.status(400).json({ error: 'testId обязателен' });

  const test = await Test.findByPk(testId);
  if (!test || !test.isActive) return res.status(404).json({ error: 'Банк не найден' });

  let questions = await loadQuestionsForTest(testId);

  const topicIds = (topicTagIds || []).map(Number).filter(Boolean);
  const skillIds = (skillTagIds || []).map(Number).filter(Boolean);

  if (topicIds.length || skillIds.length) {
    questions = questions.filter((q) => {
      const ids = (q.QuestionTags || []).map((t) => t.id);
      const topicOk = !topicIds.length || topicIds.some((id) => ids.includes(id));
      const skillOk = !skillIds.length || skillIds.some((id) => ids.includes(id));
      return topicOk && skillOk;
    });
  }

  if (questionMode === 'unsolved' || questionMode === 'incorrect') {
    const results = await TestResult.findAll({
      where: { userId: req.user.id, testId },
    });
    const seen = new Set();
    const wrong = new Set();
    for (const result of results) {
      for (const item of result.answers || []) {
        if (item.questionId) seen.add(item.questionId);
        if (item.correct === false) wrong.add(item.questionId);
      }
    }
    questions = questions.filter((q) => (
      questionMode === 'unsolved' ? !seen.has(q.id) : wrong.has(q.id)
    ));
  }

  const limit = Math.max(1, Math.min(80, Number(questionCount) || 20));
  const mixed = shuffle(questions);
  const picked = pickQuestionsKeepingLinkedOrder(mixed, limit);

  const payload = picked.map((q) => {
    const shaped = publicQuestionShape(q);
    if (randomizeAnswers) shaped.answers = shuffle(shaped.answers);
    return shaped;
  });

  res.json({
    test: { id: test.id, name: test.name, hasExplanations: test.hasExplanations },
    questions: payload,
  });
});

router.get('/ort/flashcards', async (req, res) => {
  const where = { isActive: true };
  if (req.query.testId) where.testId = Number(req.query.testId);
  if (req.query.trackGroup) where.trackGroup = req.query.trackGroup;

  const include = [{ model: QuestionTag }];
  if (req.query.tagId) {
    include[0].where = { id: Number(req.query.tagId) };
    include[0].required = true;
  }

  const cards = await Flashcard.findAll({
    where,
    include,
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });

  res.json({
    flashcards: cards.map((c) => ({
      id: c.id,
      testId: c.testId,
      trackGroup: c.trackGroup,
      frontText: c.frontText,
      backText: c.backText,
      frontImageUrl: c.frontImageUrl,
      backImageUrl: c.backImageUrl,
      tags: (c.QuestionTags || []).map((t) => ({ id: t.id, name: t.name, slug: t.slug, kind: t.kind })),
    })),
  });
});

router.get('/tests/:id/questions', requireOrtSubscription, async (req, res) => {
  const questions = await loadQuestionsForTest(req.params.id);
  res.json({ questions: questions.map(publicQuestionShape) });
});

router.post('/tests/:id/check', requireOrtSubscription, async (req, res) => {
  const { answers = [], durationSec, questionMode } = req.body || {};
  const questions = await loadQuestionsForTest(req.params.id, {
    id: { [Op.in]: answers.map((a) => a.questionId).filter(Boolean) },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  let score = 0;
  const reviewed = answers.map((item) => {
    const q = byId.get(item.questionId);
    const correct = q
      ? (q.Answers || []).some((a) => a.id === item.answerId && a.isCorrect)
      : false;
    if (correct) score += 1;
    return {
      questionId: item.questionId,
      answerId: item.answerId,
      correct,
      question: q ? publicQuestionWithCorrect(q) : null,
    };
  });

  const result = await TestResult.create({
    userId: req.user.id,
    testId: Number(req.params.id),
    score,
    total: reviewed.length,
    questionMode: questionMode || 'all',
    answers: reviewed.map((r) => ({
      questionId: r.questionId,
      answerId: r.answerId,
      correct: r.correct,
    })),
    durationSec: durationSec || null,
  });

  res.json({
    resultId: result.id,
    score,
    total: reviewed.length,
    accuracy: reviewed.length ? Math.round((score / reviewed.length) * 100) : 0,
    items: reviewed,
  });
});

module.exports = router;

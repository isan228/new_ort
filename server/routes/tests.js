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
const { scoreAnswers } = require('../utils/ortScoring');
const { previewMainExam, assembleMainExam } = require('../utils/buildMainExam');

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

function parseIdList(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(raw.map((item) => Number(item)).filter(Boolean))];
}

function parseModes(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const allowed = new Set(['unused', 'unsolved', 'solved', 'correct', 'incorrect']);
  return [...new Set(raw.map((item) => String(item || '').trim()).filter((item) => allowed.has(item)))]
    .map((item) => (item === 'unsolved' ? 'unused' : item));
}

async function loadUserLastAnswers(userId) {
  const results = await TestResult.findAll({
    where: { userId },
    attributes: ['answers'],
    order: [['id', 'ASC']],
  });
  const last = new Map();
  for (const result of results) {
    for (const item of result.answers || []) {
      if (item.questionId) last.set(item.questionId, item.correct === true);
    }
  }
  return last;
}

function questionFlags(questionId, last) {
  const seen = last.has(questionId);
  const ok = last.get(questionId) === true;
  return {
    unused: !seen,
    solved: seen,
    correct: seen && ok,
    incorrect: seen && !ok,
  };
}

function matchesModes(flags, modes) {
  if (!modes.length) return true;
  return modes.some((mode) => flags[mode]);
}

function emptyStats() {
  return { all: 0, unused: 0, solved: 0, correct: 0, incorrect: 0, available: 0 };
}

function bumpStats(bucket, flags, available) {
  bucket.all += 1;
  if (flags.unused) bucket.unused += 1;
  if (flags.solved) bucket.solved += 1;
  if (flags.correct) bucket.correct += 1;
  if (flags.incorrect) bucket.incorrect += 1;
  if (available) bucket.available += 1;
}

function serializeSubjectForStudent(subject) {
  const json = subject.toJSON();
  const tests = (json.Tests || [])
    .map((test) => {
      const questionCount = (test.Questions || []).length;
      const { Questions, ...rest } = test;
      return { ...rest, questionCount };
    })
    .filter((test) => test.questionCount > 0);
  delete json.Tests;
  delete json.tests;
  return { ...json, Tests: tests };
}

async function gradeSubmission({ userId, testId, answers, durationSec, questionMode, examType }) {
  const ids = (answers || []).map((item) => item.questionId).filter(Boolean);
  const questions = await Question.findAll({
    where: { id: { [Op.in]: ids.length ? ids : [0] }, isActive: true },
    include: [
      { model: Answer },
      { model: QuestionTag },
    ],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Answer, 'sortOrder', 'ASC']],
  });
  const tests = await Test.findAll({
    where: { id: [...new Set(questions.map((q) => q.testId))] },
  });
  const testById = new Map(tests.map((row) => [row.id, row]));
  const byId = new Map(questions.map((q) => [q.id, q]));

  let score = 0;
  const reviewed = (answers || []).map((item) => {
    const q = byId.get(item.questionId);
    const correct = q
      ? (q.Answers || []).some((a) => a.id === item.answerId && a.isCorrect)
      : false;
    if (correct) score += 1;
    const part = q ? testById.get(q.testId)?.ortPart : null;
    return {
      questionId: item.questionId,
      answerId: item.answerId,
      correct,
      ortPart: part || null,
      question: q ? publicQuestionWithCorrect(q) : null,
    };
  });

  const scoring = scoreAnswers(reviewed, examType);
  const result = await TestResult.create({
    userId,
    testId,
    score,
    officialScore: scoring.officialScore,
    scoreBreakdown: {
      examType: examType || scoring.examType,
      maxScore: scoring.maxScore,
      blocks: scoring.breakdown,
    },
    total: reviewed.length,
    questionMode: questionMode || 'all',
    answers: reviewed.map((row) => ({
      questionId: row.questionId,
      answerId: row.answerId,
      correct: row.correct,
      ortPart: row.ortPart,
    })),
    durationSec: durationSec || null,
  });

  return {
    resultId: result.id,
    score,
    officialScore: scoring.officialScore,
    maxScore: scoring.maxScore,
    breakdown: scoring.breakdown,
    examType: examType || scoring.examType,
    total: reviewed.length,
    accuracy: reviewed.length ? Math.round((score / reviewed.length) * 100) : 0,
    items: reviewed,
  };
}

router.get('/ort/dashboard', async (req, res) => {
  const subjects = await Subject.findAll({
    where: { isActive: true },
    include: [{
      model: Test,
      where: { isActive: true },
      required: false,
      include: [{ model: Question, attributes: ['id'], where: { isActive: true }, required: false }],
    }],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Test, 'sortOrder', 'ASC']],
  });

  const grouped = { main: [], state_lang: [], subject: [] };
  for (const subject of subjects) {
    const row = serializeSubjectForStudent(subject);
    if (!row.Tests.length) continue;
    const bucket = grouped[row.trackGroup] || grouped.subject;
    bucket.push(row);
  }
  res.json({ ...grouped, mainExam: await previewMainExam() });
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
      officialScore: r.officialScore,
      maxScore: r.scoreBreakdown?.maxScore || null,
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

router.get('/ort/builder', async (req, res) => {
  const selectedTests = parseIdList(req.query.testIds);
  const selectedTags = parseIdList(req.query.tagIds);
  const modes = parseModes(req.query.modes);
  const last = await loadUserLastAnswers(req.user.id);

  const subjects = await Subject.findAll({
    where: { isActive: true },
    include: [{ model: Test, where: { isActive: true }, required: false }],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Test, 'sortOrder', 'ASC']],
  });

  const questions = await Question.findAll({
    where: { isActive: true },
    attributes: ['id', 'testId'],
    include: [{
      model: QuestionTag,
      attributes: ['id', 'name', 'kind'],
      where: { isActive: true },
      required: false,
    }],
  });

  const byTest = new Map();
  const tagMap = new Map();
  const status = emptyStats();
  let available = 0;

  for (const question of questions) {
    const flags = questionFlags(question.id, last);
    const tagIds = (question.QuestionTags || []).map((tag) => tag.id);
    const testsOk = !selectedTests.length || selectedTests.includes(question.testId);
    const tagsOk = !selectedTags.length || selectedTags.some((id) => tagIds.includes(id));
    const modeOk = matchesModes(flags, modes);

    if (!byTest.has(question.testId)) byTest.set(question.testId, emptyStats());
    if (tagsOk) bumpStats(byTest.get(question.testId), flags, modeOk);

    if (testsOk && tagsOk) bumpStats(status, flags, modeOk);
    if (testsOk && tagsOk && modeOk) available += 1;

    if (testsOk && modeOk) {
      for (const tag of question.QuestionTags || []) {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, {
            id: tag.id,
            name: tag.name,
            kind: tag.kind,
            ...emptyStats(),
          });
        }
        bumpStats(tagMap.get(tag.id), flags, true);
      }
    }
  }

  const groups = subjects.map((subject) => {
    const sections = (subject.Tests || [])
      .map((test) => ({
        id: test.id,
        name: test.name,
        subjectId: subject.id,
        subjectName: subject.name,
        trackGroup: subject.trackGroup,
        ...(byTest.get(test.id) || emptyStats()),
      }))
      .filter((test) => test.all > 0);
    return {
      id: subject.id,
      name: subject.name,
      trackGroup: subject.trackGroup,
      sections,
    };
  }).filter((group) => group.sections.length);

  const tags = [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  res.json({ groups, tags, status, available });
});

router.post('/ort/custom-test/questions', async (req, res) => {
  const {
    testId,
    testIds = [],
    topicTagIds = [],
    skillTagIds = [],
    tagIds = [],
    questionCount = 20,
    questionMode = 'all',
    modes = [],
    minutes,
    name,
    randomizeAnswers = true,
  } = req.body || {};

  const sectionIds = parseIdList([...testIds, testId].filter(Boolean));
  const selectedTags = parseIdList(tagIds);
  const topicIds = parseIdList(topicTagIds);
  const skillIds = parseIdList(skillTagIds);
  let selectedModes = parseModes(modes);
  if (!selectedModes.length && (questionMode === 'unsolved' || questionMode === 'incorrect')) {
    selectedModes = [questionMode === 'unsolved' ? 'unused' : 'incorrect'];
  }

  const testWhere = { isActive: true };
  if (sectionIds.length) testWhere.id = sectionIds;
  const tests = await Test.findAll({ where: testWhere });
  if (!tests.length) return res.status(404).json({ error: 'Разделы не найдены' });

  const questions = await Question.findAll({
    where: { testId: tests.map((row) => row.id), isActive: true },
    include: [
      { model: Answer },
      { model: QuestionTag },
    ],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Answer, 'sortOrder', 'ASC']],
  });

  const last = await loadUserLastAnswers(req.user.id);

  const filtered = questions.filter((question) => {
    const ids = (question.QuestionTags || []).map((tag) => tag.id);
    if (selectedTags.length && !selectedTags.some((id) => ids.includes(id))) return false;
    if (topicIds.length && !topicIds.some((id) => ids.includes(id))) return false;
    if (skillIds.length && !skillIds.some((id) => ids.includes(id))) return false;
    return matchesModes(questionFlags(question.id, last), selectedModes);
  });

  const limit = Math.max(1, Math.min(150, Number(questionCount) || 20));
  const picked = pickQuestionsKeepingLinkedOrder(shuffle(filtered), limit);
  if (!picked.length) return res.status(400).json({ error: 'Нет вопросов по выбранным фильтрам' });

  const payload = picked.map((question) => {
    const shaped = publicQuestionShape(question);
    if (randomizeAnswers) shaped.answers = shuffle(shaped.answers);
    return shaped;
  });

  const title = String(name || '').trim() || (tests.length === 1 ? tests[0].name : 'Свой тест');
  const timed = Math.max(0, Math.min(240, Number(minutes) || 0));

  res.json({
    examType: 'custom',
    test: {
      id: tests[0].id,
      name: title,
      hasExplanations: tests.some((row) => row.hasExplanations),
      ortPart: tests[0].ortPart,
    },
    questions: payload,
    minutes: timed,
  });
});

router.get('/ort/main-exam', async (req, res) => {
  res.json(await previewMainExam());
});

router.post('/ort/main-exam', async (req, res) => {
  const { questions, preview, sections, anchor } = await assembleMainExam();
  if (!questions.length) {
    return res.status(400).json({ error: 'В основном тесте пока нет вопросов. Загрузите разделы в админке.' });
  }
  const randomize = req.body?.randomizeAnswers !== false;
  const payload = questions.map((q) => {
    const shaped = publicQuestionShape(q);
    if (randomize) shaped.answers = shuffle(shaped.answers);
    return shaped;
  });
  res.json({
    examType: 'main',
    simulation: true,
    test: {
      id: anchor?.id || null,
      name: 'Основной тест ОРТ',
      hasExplanations: true,
    },
    questions: payload,
    sections,
    ...preview,
  });
});

router.post('/ort/check', async (req, res) => {
  const { answers = [], durationSec, questionMode, testId, examType } = req.body || {};
  const ids = answers.map((item) => item.questionId).filter(Boolean);
  const first = ids.length
    ? await Question.findOne({ where: { id: ids[0] } })
    : null;
  const resolvedTestId = Number(testId) || first?.testId;
  if (!resolvedTestId) return res.status(400).json({ error: 'Нет вопросов для проверки' });
  const payload = await gradeSubmission({
    userId: req.user.id,
    testId: resolvedTestId,
    answers,
    durationSec,
    questionMode: questionMode || (examType === 'main' ? 'main_exam' : 'all'),
    examType,
  });
  res.json(payload);
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
  const { answers = [], durationSec, questionMode, examType } = req.body || {};
  const payload = await gradeSubmission({
    userId: req.user.id,
    testId: Number(req.params.id),
    answers,
    durationSec,
    questionMode,
    examType,
  });
  res.json(payload);
});

module.exports = router;

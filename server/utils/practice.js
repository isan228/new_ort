const {
  Subject,
  Test,
  Question,
  Answer,
  PracticeSession,
  PracticeAnswer,
  QuestionFlag,
} = require('../models');
const { publicQuestionShape } = require('./ortLinkedQuestions');
const { isCompare } = require('./compareQuestions');
const { MAX_DIFFICULTY } = require('./txtQuestionAnswers');
const { practiceTest, sectionPath, loadUserLastAnswers, gradeSubmission } = require('./practiceGrading');

const FILTERS = ['unused', 'incorrect', 'correct', 'flagged'];
const MAX_COUNT = 200;
const MAX_MINUTES = 300;
// A click sent just before 00:00 still counts.
const GRACE_MS = 3000;

class PracticeError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseIds(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

function parseDifficulty(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_DIFFICULTY ? n : 'mixed';
}

// "all" (or nothing) means no status filter; the other filters are combined as a union.
function parseFilters(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const list = raw.map((item) => String(item || '').trim());
  if (list.includes('all')) return [];
  return FILTERS.filter((key) => list.includes(key));
}

function statusOf(questionId, last, flags) {
  const seen = last.has(questionId);
  return {
    unused: !seen,
    correct: seen && last.get(questionId) === true,
    incorrect: seen && last.get(questionId) === false,
    flagged: flags.has(questionId),
  };
}

const matchesFilters = (status, filters) => !filters.length || filters.some((key) => status[key]);
const matchesDifficulty = (q, difficulty) => difficulty === 'mixed' || q.difficulty === difficulty;

async function flagSet(userId) {
  const rows = await QuestionFlag.findAll({ where: { userId }, attributes: ['questionId'] });
  return new Set(rows.map((row) => row.questionId));
}

// Practice tree: subjects → sections; leaf sections (not groups) are the topics a student can pick.
async function loadCatalog() {
  const subjects = await Subject.findAll({
    where: { isActive: true, bank: 'practice' },
    include: [{ model: Test, where: { isActive: true }, required: false }],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Test, 'sortOrder', 'ASC'], [Test, 'id', 'ASC']],
  });
  const tests = subjects.flatMap((s) => s.Tests || []);
  const testById = new Map(tests.map((t) => [t.id, t]));
  const questions = await Question.findAll({
    where: { isActive: true, passageId: null, testId: tests.map((t) => t.id).length ? tests.map((t) => t.id) : [0] },
    attributes: ['id', 'testId', 'difficulty'],
    include: [practiceTest()],
  });
  return { subjects, testById, questions };
}

function topicMeta(test, testById, subjectById) {
  const subject = subjectById.get(test.subjectId);
  return { testId: test.id, subjectId: test.subjectId, subjectName: subject?.name || '', name: sectionPath(test, testById) };
}

async function builderData(userId, query) {
  const testIds = parseIds(query.testIds);
  const difficulty = parseDifficulty(query.difficulty);
  const filters = parseFilters(query.filters);
  const [{ subjects, testById, questions }, last, flags] = await Promise.all([
    loadCatalog(),
    loadUserLastAnswers(userId),
    flagSet(userId),
  ]);

  const perTopic = new Map();
  const counts = { all: 0, unused: 0, incorrect: 0, correct: 0, flagged: 0 };
  let available = 0;
  const selected = new Set(testIds);
  for (const q of questions) {
    const status = statusOf(q.id, last, flags);
    const diffOk = matchesDifficulty(q, difficulty);
    const row = perTopic.get(q.testId) || { total: 0, matching: 0 };
    row.total += 1;
    if (diffOk && matchesFilters(status, filters)) row.matching += 1;
    perTopic.set(q.testId, row);
    if (!selected.has(q.testId) || !diffOk) continue;
    counts.all += 1;
    for (const key of FILTERS) if (status[key]) counts[key] += 1;
    if (matchesFilters(status, filters)) available += 1;
  }

  const out = [];
  for (const subject of subjects) {
    const tests = subject.Tests || [];
    const visible = new Set();
    for (const test of tests) {
      if (test.kind === 'group' || !perTopic.get(test.id)?.total) continue;
      for (let node = test; node && !visible.has(node.id); node = testById.get(node.parentId)) visible.add(node.id);
    }
    if (!visible.size) continue;
    out.push({
      id: subject.id,
      name: subject.name,
      trackGroup: subject.trackGroup,
      sections: tests.filter((t) => visible.has(t.id)).map((t) => ({
        id: t.id,
        name: t.name,
        parentId: t.parentId || null,
        leaf: t.kind !== 'group',
        total: perTopic.get(t.id)?.total || 0,
        matching: perTopic.get(t.id)?.matching || 0,
      })),
    });
  }
  return { subjects: out, counts, available, difficulty, filters };
}

// Spreads `count` over topics as evenly as possible; random topics take the remainder,
// and topics that run out pass their share on to topics that still have questions.
function distribute(pools, count) {
  const quota = new Map(pools.map((p) => [p.testId, 0]));
  let remaining = count;
  while (remaining > 0) {
    const open = shuffle(pools.filter((p) => quota.get(p.testId) < p.items.length));
    if (!open.length) break;
    const share = Math.floor(remaining / open.length);
    const extra = remaining % open.length;
    for (const [i, pool] of open.entries()) {
      const want = share + (i < extra ? 1 : 0);
      const give = Math.min(want, pool.items.length - quota.get(pool.testId));
      quota.set(pool.testId, quota.get(pool.testId) + give);
      remaining -= give;
    }
  }
  return quota;
}

function answerOrder(q) {
  const ids = [...(q.Answers || [])].sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id)).map((a) => a.id);
  return isCompare(q) ? ids : shuffle(ids);
}

async function createSession(userId, body) {
  const testIds = parseIds(body.testIds);
  const difficulty = parseDifficulty(body.difficulty);
  const filters = parseFilters(body.filters);
  const count = Math.round(Number(body.count));
  const minutes = body.timer ? Math.round(Number(body.minutes)) : 0;
  if (!testIds.length) throw new PracticeError(400, 'NO_TOPICS', 'Выберите хотя бы одну тему');
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new PracticeError(400, 'BAD_COUNT', `Число вопросов — от 1 до ${MAX_COUNT}`);
  }
  if (body.timer && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES)) {
    throw new PracticeError(400, 'BAD_MINUTES', `Время — от 1 до ${MAX_MINUTES} минут`);
  }

  const { subjects, testById } = await loadCatalog();
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const topics = testIds.map((id) => testById.get(id)).filter((t) => t && t.kind !== 'group');
  if (!topics.length) throw new PracticeError(400, 'NO_TOPICS', 'Выберите хотя бы одну тему');

  const [questions, last, flags] = await Promise.all([
    Question.findAll({
      where: { isActive: true, passageId: null, testId: topics.map((t) => t.id) },
      include: [{ model: Answer, attributes: ['id', 'sortOrder'] }, practiceTest()],
    }),
    loadUserLastAnswers(userId),
    flagSet(userId),
  ]);
  const pools = topics.map((t) => ({
    testId: t.id,
    items: shuffle(questions.filter((q) => q.testId === t.id
      && (q.Answers || []).length >= 2
      && matchesDifficulty(q, difficulty)
      && matchesFilters(statusOf(q.id, last, flags), filters))),
  }));
  const available = pools.reduce((sum, p) => sum + p.items.length, 0);
  if (available < count) {
    throw new PracticeError(400, 'POOL_TOO_SMALL',
      available
        ? `По выбранным темам, сложности и фильтрам есть только ${available} подходящих вопросов, а нужно ${count}. Уменьшите число вопросов или расширьте выбор.`
        : 'По выбранным темам, сложности и фильтрам нет подходящих вопросов. Измените выбор.',
      { available });
  }

  const quota = distribute(pools, count);
  const picked = shuffle(pools.flatMap((p) => p.items.slice(0, quota.get(p.testId))));
  return PracticeSession.create({
    userId,
    status: 'active',
    config: { testIds: topics.map((t) => t.id), difficulty, filters, count, minutes, instant: !!body.instant },
    items: picked.map((q) => ({ questionId: q.id, testId: q.testId, answerOrder: answerOrder(q) })),
    topics: topics.map((t) => topicMeta(t, testById, subjectById)),
    deadline: minutes ? new Date(Date.now() + minutes * 60 * 1000) : null,
  });
}

const expired = (session, now = Date.now()) => !!session.deadline && now > new Date(session.deadline).getTime() + GRACE_MS;
const timeIsUp = (session) => !!session.deadline && Date.now() >= new Date(session.deadline).getTime() - 1000;

async function answerMap(sessionId, transaction) {
  const rows = await PracticeAnswer.findAll({ where: { sessionId }, transaction });
  return new Map(rows.filter((r) => r.answerId).map((r) => [r.questionId, r.answerId]));
}

function tally() {
  return { total: 0, correct: 0, wrong: 0, skipped: 0 };
}

function withPercent(row) {
  return { ...row, percent: row.total ? Math.round((row.correct / row.total) * 100) : 0 };
}

async function finalize(session, reason, transaction) {
  if (session.status !== 'active') return;
  const answers = await answerMap(session.id, transaction);
  const end = session.deadline ? Math.min(Date.now(), new Date(session.deadline).getTime()) : Date.now();
  const graded = await gradeSubmission({
    userId: session.userId,
    testId: session.items[0]?.testId || session.topics[0]?.testId,
    answers: session.items.map((item) => ({ questionId: item.questionId, answerId: answers.get(item.questionId) || null })),
    durationSec: Math.round((end - new Date(session.createdAt).getTime()) / 1000),
    questionMode: `custom:${session.config.filters.join('+') || 'all'}`,
    examType: 'custom',
  });
  const correctById = new Map(graded.items.map((row) => [row.questionId, row.correct]));

  const total = tally();
  const byTopic = new Map(session.topics.map((t) => [t.testId, tally()]));
  const items = session.items.map((item) => {
    let status = 'skipped';
    if (answers.has(item.questionId)) status = correctById.get(item.questionId) ? 'correct' : 'wrong';
    total.total += 1;
    total[status] += 1;
    const topic = byTopic.get(item.testId);
    if (topic) {
      topic.total += 1;
      topic[status] += 1;
    }
    return { questionId: item.questionId, testId: item.testId, answerId: answers.get(item.questionId) || null, status };
  });

  const subjects = [];
  for (const meta of session.topics) {
    let subject = subjects.find((s) => s.subjectId === meta.subjectId);
    if (!subject) {
      subject = { subjectId: meta.subjectId, name: meta.subjectName, ...tally(), topics: [] };
      subjects.push(subject);
    }
    const row = byTopic.get(meta.testId);
    for (const key of ['total', 'correct', 'wrong', 'skipped']) subject[key] += row[key];
    subject.topics.push(withPercent({ testId: meta.testId, name: meta.name, ...row }));
  }

  session.status = 'finished';
  session.reason = reason;
  session.finishedAt = new Date(end);
  session.resultId = graded.resultId;
  session.result = {
    ...withPercent(total),
    durationSec: Math.round((end - new Date(session.createdAt).getTime()) / 1000),
    subjects: subjects.map((s) => ({ ...withPercent(s), topics: s.topics })),
    items,
  };
  await session.save({ transaction });
}

async function syncSession(session, transaction) {
  if (session.status === 'active' && expired(session)) await finalize(session, 'timeout', transaction);
}

function orderedAnswers(q, order) {
  const byId = new Map((q.Answers || []).map((a) => [a.id, a]));
  const known = (order || []).map((id) => byId.get(id)).filter(Boolean);
  const rest = (q.Answers || []).filter((a) => !(order || []).includes(a.id)).sort((a, b) => a.sortOrder - b.sortOrder);
  return [...known, ...rest];
}

function reveal(q) {
  return {
    correctAnswerId: (q.Answers || []).find((a) => a.isCorrect)?.id || null,
    explanation: q.explanation || '',
    explanationImageUrl: q.explanationImageUrl || null,
  };
}

async function loadSessionQuestions(session, transaction) {
  const ids = session.items.map((item) => item.questionId);
  const rows = await Question.findAll({ where: { id: ids.length ? ids : [0] }, include: [Answer], transaction });
  return new Map(rows.map((q) => [q.id, q]));
}

function shape(q, item, { withCorrect = false } = {}) {
  if (!q) return { id: item.questionId, missing: true, answers: [] };
  const base = publicQuestionShape(q);
  delete base.explanation;
  delete base.explanationImageUrl;
  base.answers = orderedAnswers(q, item.answerOrder).map((a) => ({
    id: a.id,
    text: a.text,
    imageUrl: a.imageUrl || null,
    sortOrder: a.sortOrder,
    ...(withCorrect ? { isCorrect: !!a.isCorrect } : {}),
  }));
  if (withCorrect) Object.assign(base, reveal(q));
  return base;
}

async function sessionState(session, userId, transaction) {
  const [byId, answers, flags] = await Promise.all([
    loadSessionQuestions(session, transaction),
    answerMap(session.id, transaction),
    flagSet(userId),
  ]);
  const instant = !!session.config.instant;
  const revealed = {};
  if (instant) {
    for (const [qid] of answers) if (byId.has(qid)) revealed[qid] = reveal(byId.get(qid));
  }
  return {
    id: session.id,
    status: session.status,
    reason: session.reason,
    config: session.config,
    topics: session.topics,
    serverNow: new Date().toISOString(),
    deadline: session.deadline,
    createdAt: session.createdAt,
    questions: session.items.map((item) => ({ ...shape(byId.get(item.questionId), item), flagged: flags.has(item.questionId) })),
    answers: Object.fromEntries(answers),
    revealed,
  };
}

async function saveAnswer(session, { questionId, answerId }, transaction) {
  if (session.status !== 'active') throw new PracticeError(409, 'SESSION_CLOSED', 'Тест уже завершён');
  if (expired(session)) {
    await finalize(session, 'timeout', transaction);
    throw new PracticeError(409, 'TIME_UP', 'Время вышло');
  }
  const item = session.items.find((row) => row.questionId === questionId);
  if (!item) throw new PracticeError(404, 'NOT_IN_TEST', 'Этого вопроса нет в тесте');
  const q = await Question.findByPk(questionId, { include: [Answer], transaction });
  const id = answerId ? Number(answerId) : null;
  if (!q || (id && !(q.Answers || []).some((a) => a.id === id))) {
    throw new PracticeError(400, 'BAD_ANSWER', 'Нет такого варианта ответа');
  }
  const existing = await PracticeAnswer.findOne({ where: { sessionId: session.id, questionId }, transaction });
  if (session.config.instant && existing?.answerId) {
    throw new PracticeError(409, 'ANSWER_LOCKED', 'Ответ уже проверен');
  }
  if (existing) await existing.update({ answerId: id }, { transaction });
  else await PracticeAnswer.create({ sessionId: session.id, questionId, answerId: id }, { transaction });
  return session.config.instant && id ? reveal(q) : null;
}

async function sessionReview(session, userId) {
  const [byId, flags] = await Promise.all([loadSessionQuestions(session), flagSet(userId)]);
  const topicName = new Map(session.topics.map((t) => [t.testId, t]));
  const statusById = new Map((session.result?.items || []).map((row) => [row.questionId, row]));
  return session.items.map((item) => {
    const row = statusById.get(item.questionId) || {};
    const meta = topicName.get(item.testId) || {};
    return {
      ...shape(byId.get(item.questionId), item, { withCorrect: true }),
      userAnswerId: row.answerId || null,
      status: row.status || 'skipped',
      flagged: flags.has(item.questionId),
      subjectName: meta.subjectName || '',
      topicName: meta.name || '',
    };
  });
}

function sessionSummary(session, answered = null) {
  return {
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    finishedAt: session.finishedAt,
    deadline: session.deadline,
    count: session.items.length,
    answered,
    minutes: session.config.minutes,
    instant: !!session.config.instant,
    topics: session.topics.map((t) => t.name),
    subjects: [...new Set(session.topics.map((t) => t.subjectName))],
    percent: session.result?.percent ?? null,
    correct: session.result?.correct ?? null,
  };
}

async function setFlag(userId, questionId, flagged) {
  const q = await Question.findOne({ where: { id: questionId }, include: [practiceTest()] });
  if (!q) throw new PracticeError(404, 'NOT_FOUND', 'Вопрос не найден');
  if (flagged) await QuestionFlag.findOrCreate({ where: { userId, questionId }, defaults: { userId, questionId } });
  else await QuestionFlag.destroy({ where: { userId, questionId } });
  return !!flagged;
}

async function flaggedList(userId) {
  const flags = await QuestionFlag.findAll({ where: { userId }, order: [['id', 'DESC']] });
  if (!flags.length) return [];
  const { subjects, testById } = await loadCatalog();
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const questions = await Question.findAll({
    where: { id: flags.map((f) => f.questionId), isActive: true },
    include: [practiceTest()],
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  return flags.map((f) => byId.get(f.questionId)).filter(Boolean).map((q) => {
    const test = testById.get(q.testId);
    const shaped = publicQuestionShape(q);
    return {
      id: q.id,
      testId: q.testId,
      kind: q.kind || null,
      text: shaped.text,
      compareA: q.compareA || null,
      compareB: q.compareB || null,
      difficulty: q.difficulty || null,
      topic: test ? topicMeta(test, testById, subjectById) : null,
    };
  });
}

module.exports = {
  PracticeError,
  builderData,
  createSession,
  distribute,
  syncSession,
  finalize,
  timeIsUp,
  sessionState,
  saveAnswer,
  sessionReview,
  sessionSummary,
  answerMap,
  setFlag,
  flaggedList,
};

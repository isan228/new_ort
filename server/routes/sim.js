const express = require('express');
const {
  sequelize,
  Subject,
  SimVariant,
  SimVersion,
  SimAttempt,
} = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireOrtSubscription } = require('../middleware/requireOrtSubscription');
const {
  versionData,
  syncAttempt,
  startAttempt,
  startCurrentBlock,
  closeCurrentBlock,
  finishAttempt,
  attemptState,
  saveAnswer,
  attemptReview,
  timeIsUp,
} = require('../utils/simAttempts');

const router = express.Router();
router.use(requireAuth, requireOrtSubscription);

const TRACKS = ['main', 'subject', 'state_lang'];

async function publishedVariants(subjectIds) {
  const variants = await SimVariant.findAll({
    where: { subjectId: subjectIds, status: 'published' },
    order: [['number', 'ASC'], ['id', 'ASC']],
  });
  const versionIds = variants.map((v) => v.publishedVersionId).filter(Boolean);
  const versions = versionIds.length
    ? await SimVersion.findAll({ where: { id: versionIds }, attributes: ['id', 'questionCount', 'minutes'] })
    : [];
  const byId = new Map(versions.map((v) => [v.id, v]));
  return variants.filter((v) => byId.has(v.publishedVersionId)).map((v) => ({ variant: v, version: byId.get(v.publishedVersionId) }));
}

async function userAttempts(userId, variantIds) {
  if (!variantIds.length) return [];
  const rows = await SimAttempt.findAll({
    where: { userId, variantId: variantIds },
    attributes: { exclude: ['blocks'] },
    order: [['id', 'DESC']],
  });
  return rows;
}

function attemptSummary(a) {
  return {
    id: a.id,
    variantId: a.variantId,
    status: a.status,
    createdAt: a.createdAt,
    finishedAt: a.finishedAt,
    meta: a.meta,
    total: a.result?.total ?? null,
    correct: a.result?.correct ?? null,
    wrong: a.result?.wrong ?? null,
    skipped: a.result?.skipped ?? null,
    percent: a.result?.percent ?? null,
  };
}

async function syncActive(userId) {
  const active = await SimAttempt.findAll({ where: { userId, status: 'active' }, attributes: ['id'] });
  for (const { id } of active) {
    await sequelize.transaction(async (transaction) => {
      const attempt = await SimAttempt.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (attempt) await syncAttempt(attempt, transaction);
    });
  }
}

router.get('/catalog', async (req, res) => {
  const subjects = await Subject.findAll({
    where: { bank: 'simulation', isActive: true },
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  const variants = await publishedVariants(subjects.map((s) => s.id));
  const counts = new Map();
  for (const { variant } of variants) counts.set(variant.subjectId, (counts.get(variant.subjectId) || 0) + 1);
  const grouped = Object.fromEntries(TRACKS.map((key) => [key, []]));
  for (const s of subjects) {
    (grouped[s.trackGroup] || grouped.subject).push({
      id: s.id,
      name: s.name,
      language: s.language,
      isExtra: !!s.isExtra,
      variants: counts.get(s.id) || 0,
    });
  }
  res.json(grouped);
});

router.get('/subjects/:id', async (req, res) => {
  const subject = await Subject.findOne({ where: { id: req.params.id, bank: 'simulation', isActive: true } });
  if (!subject) return res.status(404).json({ error: 'Тест не найден' });
  await syncActive(req.user.id);
  const variants = await publishedVariants([subject.id]);
  const attempts = await userAttempts(req.user.id, variants.map((row) => row.variant.id));
  res.json({
    subject: { id: subject.id, name: subject.name, trackGroup: subject.trackGroup, language: subject.language, isExtra: !!subject.isExtra },
    variants: variants.map(({ variant, version }) => {
      const mine = attempts.filter((a) => a.variantId === variant.id);
      const active = mine.find((a) => a.status === 'active');
      const last = mine.find((a) => a.status === 'finished');
      return {
        id: variant.id,
        number: variant.number,
        difficulty: variant.difficulty,
        questionCount: version.questionCount,
        minutes: version.minutes,
        attempts: mine.length,
        status: active ? 'active' : (last ? 'finished' : 'new'),
        activeAttemptId: active?.id || null,
        last: last ? attemptSummary(last) : null,
      };
    }),
  });
});

async function loadPublished(variantId) {
  const variant = await SimVariant.findOne({ where: { id: variantId, status: 'published' } });
  if (!variant?.publishedVersionId) return null;
  const subject = await Subject.findOne({ where: { id: variant.subjectId, bank: 'simulation', isActive: true } });
  return subject ? { variant, subject } : null;
}

router.get('/variants/:id', async (req, res) => {
  const found = await loadPublished(req.params.id);
  if (!found) return res.status(404).json({ error: 'Вариант не найден или снят с публикации' });
  const { variant, subject } = found;
  await syncActive(req.user.id);
  const data = await versionData(variant.publishedVersionId);
  const attempts = await userAttempts(req.user.id, [variant.id]);
  const active = attempts.find((a) => a.status === 'active');
  const finished = attempts.filter((a) => a.status === 'finished');
  res.json({
    subject: { id: subject.id, name: subject.name, trackGroup: subject.trackGroup, language: subject.language },
    variant: {
      id: variant.id,
      number: variant.number,
      difficulty: variant.difficulty,
      allowRetake: variant.allowRetake,
      questionCount: data.questionCount,
      minutes: data.minutes,
      blocks: data.blocks.map((b) => ({
        title: b.title,
        minutes: b.minutes,
        count: b.questionIds.length,
        parts: b.parts.map((p) => ({ name: p.name, count: p.count })),
      })),
    },
    activeAttemptId: active?.id || null,
    canStart: !!active || variant.allowRetake || !finished.length,
    attempts: attempts.map(attemptSummary),
  });
});

router.post('/variants/:id/start', async (req, res) => {
  const found = await loadPublished(req.params.id);
  if (!found) return res.status(404).json({ error: 'Вариант не найден или снят с публикации' });
  const { variant } = found;
  const attempt = await sequelize.transaction(async (transaction) => {
    // Locking the variant row keeps a double click from opening two attempts.
    await SimVariant.findByPk(variant.id, { transaction, lock: transaction.LOCK.UPDATE });
    const mine = await SimAttempt.findAll({ where: { userId: req.user.id, variantId: variant.id }, transaction });
    const active = mine.find((a) => a.status === 'active');
    if (active) return active;
    if (!variant.allowRetake && mine.some((a) => a.status === 'finished')) return null;
    return startAttempt({ userId: req.user.id, variant, transaction });
  });
  if (!attempt) return res.status(409).json({ error: 'Этот вариант можно пройти только один раз', code: 'SIM_NO_RETAKE' });
  res.json({ attemptId: attempt.id });
});

async function withAttempt(req, res, fn) {
  const result = await sequelize.transaction(async (transaction) => {
    const attempt = await SimAttempt.findOne({
      where: { id: req.params.id, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!attempt) return { status: 404, body: { error: 'Попытка не найдена' } };
    await syncAttempt(attempt, transaction);
    return fn(attempt, transaction);
  });
  return res.status(result.status || 200).json(result.body);
}

router.get('/attempts/:id', (req, res) => withAttempt(req, res, async (attempt, transaction) => (
  { body: await attemptState(attempt, transaction) }
)));

router.post('/attempts/:id/start-block', (req, res) => withAttempt(req, res, async (attempt, transaction) => {
  await startCurrentBlock(attempt, transaction);
  return { body: await attemptState(attempt, transaction) };
}));

router.post('/attempts/:id/answer', (req, res) => withAttempt(req, res, async (attempt, transaction) => {
  const saved = await saveAnswer(attempt, {
    questionId: Number(req.body?.questionId),
    answerId: req.body?.answerId,
  }, transaction);
  if (saved.error) return { status: saved.status, body: { error: saved.error, code: saved.code } };
  return { body: { ok: true } };
}));

router.post('/attempts/:id/close-block', (req, res) => withAttempt(req, res, async (attempt, transaction) => {
  const block = attempt.blocks[attempt.blockIndex];
  if (attempt.status === 'active' && block?.startedAt && Number(req.body?.index) === attempt.blockIndex) {
    if (!req.body?.timeout) await closeCurrentBlock(attempt, transaction);
    else if (timeIsUp(block)) await closeCurrentBlock(attempt, transaction, 'timeout');
  }
  return { body: await attemptState(attempt, transaction) };
}));

router.post('/attempts/:id/finish', (req, res) => withAttempt(req, res, async (attempt, transaction) => {
  await finishAttempt(attempt, transaction);
  return { body: await attemptState(attempt, transaction) };
}));

router.get('/attempts/:id/result', (req, res) => withAttempt(req, res, async (attempt, transaction) => {
  if (attempt.status !== 'finished') {
    return { status: 409, body: { error: 'Результаты откроются после завершения всех блоков', code: 'SIM_NOT_FINISHED' } };
  }
  return {
    body: {
      attempt: attemptSummary(attempt),
      result: attempt.result,
      review: await attemptReview(attempt, transaction),
    },
  };
}));

router.get('/history', async (req, res) => {
  await syncActive(req.user.id);
  const rows = await SimAttempt.findAll({
    where: { userId: req.user.id },
    attributes: { exclude: ['blocks'] },
    order: [['id', 'DESC']],
    limit: 100,
  });
  res.json({ attempts: rows.map(attemptSummary) });
});

module.exports = router;

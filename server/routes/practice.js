const express = require('express');
const { sequelize, PracticeSession } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireOrtSubscription } = require('../middleware/requireOrtSubscription');
const {
  PracticeError,
  builderData,
  createSession,
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
} = require('../utils/practice');

const router = express.Router();
router.use(requireAuth, requireOrtSubscription);

function fail(res, err) {
  if (err instanceof PracticeError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
  }
  throw err;
}

// Timers keep running while the student is away, so expired sessions are closed on the next visit.
async function syncUser(userId) {
  const active = await PracticeSession.findAll({ where: { userId, status: 'active' }, attributes: ['id', 'deadline'] });
  for (const row of active) {
    if (!row.deadline || new Date(row.deadline) > new Date()) continue;
    await sequelize.transaction(async (transaction) => {
      const session = await PracticeSession.findByPk(row.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (session) await syncSession(session, transaction);
    });
  }
}

router.get('/builder', async (req, res) => {
  await syncUser(req.user.id);
  res.json(await builderData(req.user.id, req.query));
});

router.post('/sessions', async (req, res) => {
  try {
    const session = await createSession(req.user.id, req.body || {});
    res.json({ id: session.id });
  } catch (err) {
    fail(res, err);
  }
});

router.get('/sessions', async (req, res) => {
  await syncUser(req.user.id);
  const status = req.query.status === 'finished' ? 'finished' : 'active';
  const rows = await PracticeSession.findAll({
    where: { userId: req.user.id, status },
    order: [['id', 'DESC']],
    limit: 30,
  });
  const out = [];
  for (const row of rows) out.push(sessionSummary(row, status === 'active' ? (await answerMap(row.id)).size : null));
  res.json({ sessions: out });
});

async function withSession(req, res, fn) {
  try {
    const body = await sequelize.transaction(async (transaction) => {
      const session = await PracticeSession.findOne({
        where: { id: req.params.id, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!session) throw new PracticeError(404, 'NOT_FOUND', 'Тест не найден');
      await syncSession(session, transaction);
      return fn(session, transaction);
    });
    res.json(body);
  } catch (err) {
    fail(res, err);
  }
}

router.get('/sessions/:id', (req, res) => withSession(req, res, (session, transaction) => (
  sessionState(session, req.user.id, transaction)
)));

router.post('/sessions/:id/answer', async (req, res) => {
  try {
    const out = await sequelize.transaction(async (transaction) => {
      const session = await PracticeSession.findOne({
        where: { id: req.params.id, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!session) throw new PracticeError(404, 'NOT_FOUND', 'Тест не найден');
      try {
        return { ok: true, reveal: await saveAnswer(session, { questionId: Number(req.body?.questionId), answerId: req.body?.answerId }, transaction) };
      } catch (err) {
        // The timeout closed the session inside this transaction; keep that, report the error.
        if (err.code === 'TIME_UP') return { error: err };
        throw err;
      }
    });
    if (out.error) return fail(res, out.error);
    return res.json(out);
  } catch (err) {
    return fail(res, err);
  }
});

router.post('/sessions/:id/finish', (req, res) => withSession(req, res, async (session, transaction) => {
  if (session.status === 'active' && (!req.body?.timeout || timeIsUp(session))) {
    await finalize(session, req.body?.timeout ? 'timeout' : 'manual', transaction);
  }
  return { status: session.status, reason: session.reason };
}));

router.get('/sessions/:id/result', (req, res) => withSession(req, res, async (session) => {
  if (session.status !== 'finished') throw new PracticeError(409, 'NOT_FINISHED', 'Тест ещё не завершён');
  return {
    session: sessionSummary(session),
    reason: session.reason,
    config: session.config,
    result: session.result,
    review: await sessionReview(session, req.user.id),
  };
}));

router.get('/flags', async (req, res) => {
  res.json({ questions: await flaggedList(req.user.id) });
});

router.put('/flags/:questionId', async (req, res) => {
  try {
    res.json({ flagged: await setFlag(req.user.id, Number(req.params.questionId), !!req.body?.flagged) });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;

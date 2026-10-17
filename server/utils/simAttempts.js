const { SimAttempt, SimAnswer, SimVersion } = require('../models');

// Answers that arrive a few seconds after the deadline still count: the request was sent in time.
const GRACE_MS = 5000;

const versionCache = new Map();

async function versionData(versionId, transaction) {
  if (versionCache.has(versionId)) return versionCache.get(versionId);
  const row = await SimVersion.findByPk(versionId, { transaction });
  if (!row) return null;
  if (versionCache.size > 50) versionCache.delete(versionCache.keys().next().value);
  versionCache.set(versionId, row.data);
  return row.data;
}

function deadlineOf(block) {
  if (!block?.startedAt) return null;
  return new Date(block.startedAt).getTime() + block.minutes * 60 * 1000;
}

// The client's own timer hit zero; a second of slack covers clock rounding, never an early close.
function timeIsUp(block) {
  const deadline = deadlineOf(block);
  return !!deadline && Date.now() >= deadline - 1000;
}

function blocksFromSnapshot(data) {
  return data.blocks.map((b) => ({
    title: b.title,
    minutes: b.minutes,
    count: b.questionIds.length,
    startedAt: null,
    closedAt: null,
    reason: null,
  }));
}

function metaFromSnapshot(data) {
  return {
    subjectId: data.subject.id,
    subjectName: data.subject.name,
    trackGroup: data.subject.trackGroup,
    number: data.variant.number,
    difficulty: data.variant.difficulty,
    questionCount: data.questionCount,
    minutes: data.minutes,
  };
}

function closeBlock(blocks, index, at, reason) {
  const next = blocks.map((b) => ({ ...b }));
  next[index].closedAt = new Date(at).toISOString();
  next[index].reason = reason;
  return next;
}

async function answerMap(attemptId, transaction) {
  const rows = await SimAnswer.findAll({ where: { attemptId }, transaction });
  return new Map(rows.filter((r) => r.answerId).map((r) => [r.questionId, r.answerId]));
}

function tally() {
  return { total: 0, correct: 0, wrong: 0, skipped: 0 };
}

function bump(bucket, status) {
  bucket.total += 1;
  bucket[status] += 1;
}

function withPercent(bucket) {
  return { ...bucket, percent: bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : 0 };
}

function questionStatus(q, answers) {
  const picked = answers.get(q.id);
  if (!picked) return 'skipped';
  return q.answers.some((a) => a.id === picked && a.isCorrect) ? 'correct' : 'wrong';
}

function computeResult(data, answers, blocks) {
  const total = tally();
  const blockRows = data.blocks.map(() => tally());
  const parts = new Map();
  const topics = new Map();

  data.blocks.forEach((block, blockIndex) => {
    for (const qid of block.questionIds) {
      const q = data.questions[qid];
      const status = questionStatus(q, answers);
      bump(total, status);
      bump(blockRows[blockIndex], status);
      if (!parts.has(q.partId)) parts.set(q.partId, { partId: q.partId, name: q.partName, blockIndex, ...tally() });
      bump(parts.get(q.partId), status);
      if (q.topicId) {
        if (!topics.has(q.topicId)) topics.set(q.topicId, { topicId: q.topicId, name: q.topicName, ...tally(), byBlock: new Map() });
        const topic = topics.get(q.topicId);
        bump(topic, status);
        if (!topic.byBlock.has(blockIndex)) topic.byBlock.set(blockIndex, { blockIndex, title: block.title, ...tally() });
        bump(topic.byBlock.get(blockIndex), status);
      }
    }
  });

  return {
    ...withPercent(total),
    blocks: data.blocks.map((block, i) => {
      const state = blocks[i] || {};
      const spent = state.startedAt && state.closedAt
        ? Math.round((new Date(state.closedAt) - new Date(state.startedAt)) / 1000)
        : 0;
      return { title: block.title, minutes: block.minutes, spentSec: Math.max(0, spent), reason: state.reason || null, ...withPercent(blockRows[i]) };
    }),
    parts: [...parts.values()].map(withPercent),
    topics: [...topics.values()].map((topic) => ({
      ...withPercent(topic),
      byBlock: [...topic.byBlock.values()].map(withPercent),
    })),
  };
}

async function finalize(attempt, transaction) {
  const data = await versionData(attempt.versionId, transaction);
  const answers = await answerMap(attempt.id, transaction);
  const closedTimes = attempt.blocks.map((b) => b.closedAt).filter(Boolean).map((v) => new Date(v).getTime());
  attempt.status = 'finished';
  attempt.finishedAt = new Date(Math.min(Date.now(), Math.max(...closedTimes, 0) || Date.now()));
  attempt.result = computeResult(data, answers, attempt.blocks);
}

// Closes blocks whose time ran out while nobody was looking and finishes the attempt after the last one.
async function syncAttempt(attempt, transaction, now = Date.now()) {
  if (attempt.status !== 'active') return false;
  let changed = false;
  let { blocks, blockIndex } = attempt;
  while (blockIndex < blocks.length) {
    const deadline = deadlineOf(blocks[blockIndex]);
    if (!deadline || blocks[blockIndex].closedAt || now <= deadline + GRACE_MS) break;
    blocks = closeBlock(blocks, blockIndex, deadline, 'timeout');
    blockIndex += 1;
    changed = true;
  }
  if (changed) {
    attempt.blocks = blocks;
    attempt.blockIndex = blockIndex;
  }
  if (attempt.blockIndex >= attempt.blocks.length) {
    await finalize(attempt, transaction);
    changed = true;
  }
  if (changed) await attempt.save({ transaction });
  return changed;
}

async function startAttempt({ userId, variant, transaction }) {
  const data = await versionData(variant.publishedVersionId, transaction);
  const blocks = blocksFromSnapshot(data);
  blocks[0].startedAt = new Date().toISOString();
  return SimAttempt.create({
    userId,
    variantId: variant.id,
    versionId: variant.publishedVersionId,
    status: 'active',
    blockIndex: 0,
    blocks,
    meta: metaFromSnapshot(data),
  }, { transaction });
}

async function startCurrentBlock(attempt, transaction) {
  const i = attempt.blockIndex;
  if (attempt.status !== 'active' || i >= attempt.blocks.length || attempt.blocks[i].startedAt) return;
  const blocks = attempt.blocks.map((b) => ({ ...b }));
  blocks[i].startedAt = new Date().toISOString();
  attempt.blocks = blocks;
  await attempt.save({ transaction });
}

async function closeCurrentBlock(attempt, transaction, reason = 'manual') {
  const i = attempt.blockIndex;
  if (attempt.status !== 'active' || i >= attempt.blocks.length) return;
  const deadline = deadlineOf(attempt.blocks[i]);
  attempt.blocks = closeBlock(attempt.blocks, i, deadline ? Math.min(Date.now(), deadline) : Date.now(), reason);
  attempt.blockIndex = i + 1;
  if (attempt.blockIndex >= attempt.blocks.length) await finalize(attempt, transaction);
  await attempt.save({ transaction });
}

async function finishAttempt(attempt, transaction) {
  if (attempt.status !== 'active') return;
  let blocks = attempt.blocks;
  for (let i = attempt.blockIndex; i < blocks.length; i += 1) {
    blocks = closeBlock(blocks, i, Date.now(), 'finish');
  }
  attempt.blocks = blocks;
  attempt.blockIndex = blocks.length;
  await finalize(attempt, transaction);
  await attempt.save({ transaction });
}

function publicQuestion(q) {
  return {
    id: q.id,
    kind: q.kind,
    text: q.text,
    imageUrl: q.imageUrl,
    compareA: q.compareA,
    compareB: q.compareB,
    passageId: q.passageId,
    partName: q.partName,
    answers: q.answers.map((a) => ({ id: a.id, text: a.text, imageUrl: a.imageUrl, sortOrder: a.sortOrder })),
  };
}

function blockPassages(data, questionIds) {
  const out = {};
  for (const qid of questionIds) {
    const pid = data.questions[qid].passageId;
    if (pid && data.passages[pid]) out[pid] = data.passages[pid];
  }
  return out;
}

// What the runner needs right now; correct answers and explanations never leave the server here.
async function attemptState(attempt, transaction) {
  const base = {
    id: attempt.id,
    variantId: attempt.variantId,
    status: attempt.status,
    blockIndex: attempt.blockIndex,
    meta: attempt.meta,
    serverNow: new Date().toISOString(),
    blocks: attempt.blocks.map((b, i) => {
      let status = 'pending';
      if (b.closedAt) status = 'done';
      else if (i === attempt.blockIndex) status = 'current';
      return { title: b.title, minutes: b.minutes, count: b.count, status, reason: b.reason };
    }),
  };
  if (attempt.status !== 'active') return base;

  const data = await versionData(attempt.versionId, transaction);
  const block = attempt.blocks[attempt.blockIndex];
  const spec = data.blocks[attempt.blockIndex];
  if (!block.startedAt) {
    return { ...base, current: { index: attempt.blockIndex, phase: 'intro', parts: spec.parts } };
  }
  const deadline = deadlineOf(block);
  const answers = await answerMap(attempt.id, transaction);
  const picked = {};
  for (const qid of spec.questionIds) if (answers.has(qid)) picked[qid] = answers.get(qid);
  return {
    ...base,
    current: {
      index: attempt.blockIndex,
      phase: 'running',
      parts: spec.parts,
      deadline: new Date(deadline).toISOString(),
      remainingSec: Math.max(0, Math.round((deadline - Date.now()) / 1000)),
      questions: spec.questionIds.map((qid) => publicQuestion(data.questions[qid])),
      passages: blockPassages(data, spec.questionIds),
      answers: picked,
    },
  };
}

async function saveAnswer(attempt, { questionId, answerId }, transaction) {
  if (attempt.status !== 'active') return { status: 409, error: 'Попытка уже завершена', code: 'SIM_CLOSED' };
  const data = await versionData(attempt.versionId, transaction);
  const block = attempt.blocks[attempt.blockIndex];
  const q = data.questions[questionId];
  if (!q || q.blockIndex !== attempt.blockIndex) {
    return { status: 409, error: 'Этот вопрос не из открытого блока', code: 'SIM_BLOCK_CLOSED' };
  }
  const deadline = deadlineOf(block);
  if (!deadline || block.closedAt || Date.now() > deadline + GRACE_MS) {
    return { status: 409, error: 'Время блока вышло', code: 'SIM_BLOCK_CLOSED' };
  }
  const id = answerId ? Number(answerId) : null;
  if (id && !q.answers.some((a) => a.id === id)) return { status: 400, error: 'Нет такого варианта ответа' };
  const existing = await SimAnswer.findOne({ where: { attemptId: attempt.id, questionId: q.id }, transaction });
  if (existing) await existing.update({ answerId: id }, { transaction });
  else await SimAnswer.create({ attemptId: attempt.id, questionId: q.id, answerId: id }, { transaction });
  return { ok: true };
}

async function attemptReview(attempt, transaction) {
  const data = await versionData(attempt.versionId, transaction);
  const answers = await answerMap(attempt.id, transaction);
  return {
    blocks: data.blocks.map((block) => ({
      title: block.title,
      questions: block.questionIds.map((qid) => {
        const q = data.questions[qid];
        return { ...q, userAnswerId: answers.get(qid) || null, status: questionStatus(q, answers) };
      }),
    })),
    passages: data.passages,
  };
}

module.exports = {
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
};

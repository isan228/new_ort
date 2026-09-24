const { Op } = require('sequelize');
const { Test, Question, Answer, QuestionTag, Subject } = require('../models');
const { pickQuestionsKeepingLinkedOrder } = require('./ortLinkedQuestions');
const { ORT_PARTS, MAIN_MAX } = require('./ortScoring');

const MAIN_SLOTS = [
  { key: 'analogies', parts: ['analogies'], fallback: ['sentence', 'reading'], count: 20 },
  { key: 'sentence', parts: ['sentence'], fallback: ['analogies', 'reading'], count: 10 },
  { key: 'reading', parts: ['reading'], fallback: ['analogies', 'sentence'], count: 30 },
  { key: 'grammar', parts: ['grammar'], fallback: [], count: 30 },
  { key: 'math1', parts: ['math1'], fallback: ['math', 'math2'], count: 30 },
  { key: 'math2', parts: ['math2'], fallback: ['math', 'math1'], count: 30 },
];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function take(pool, count, used) {
  const available = pool.filter((q) => !used.has(q.id));
  const picked = pickQuestionsKeepingLinkedOrder(shuffle(available), count);
  picked.forEach((q) => used.add(q.id));
  return picked;
}

async function loadQuestionsByPart() {
  const tests = await Test.findAll({
    where: { isActive: true, ortPart: { [Op.ne]: null } },
    include: [{
      model: Question,
      where: { isActive: true },
      required: false,
      include: [{ model: Answer }, { model: QuestionTag }],
    }],
  });

  const byPart = {};
  for (const test of tests) {
    const part = test.ortPart;
    if (!byPart[part]) byPart[part] = [];
    for (const question of test.Questions || []) {
      question.setDataValue('ortPart', part);
      byPart[part].push(question);
    }
  }
  return { tests, byPart };
}

function poolFor(byPart, keys) {
  return keys.flatMap((key) => byPart[key] || []);
}

function assembleFromPools(byPart) {
  const used = new Set();
  const blocks = [];

  for (const slot of MAIN_SLOTS) {
    let picked = take(poolFor(byPart, slot.parts), slot.count, used);
    if (picked.length < slot.count && slot.fallback.length) {
      picked = picked.concat(take(poolFor(byPart, slot.fallback), slot.count - picked.length, used));
    }
    blocks.push({
      key: slot.key,
      title: ORT_PARTS[slot.key]?.title || slot.key,
      needed: slot.count,
      have: poolFor(byPart, slot.parts).length,
      questions: picked,
    });
  }

  return blocks;
}

function previewFromBlocks(blocks) {
  const questionCount = blocks.reduce((sum, block) => sum + block.questions.length, 0);
  return {
    questionCount,
    maxQuestions: 150,
    maxScore: MAIN_MAX,
    ready: questionCount > 0,
    minutes: Math.max(20, Math.round((questionCount / 150) * 210)),
    parts: blocks.map((block) => ({
      key: block.key,
      title: block.title,
      needed: block.needed,
      have: block.have,
      picked: block.questions.length,
    })),
  };
}

async function countByPart() {
  const tests = await Test.findAll({
    where: { isActive: true, ortPart: { [Op.ne]: null } },
    include: [{ model: Question, attributes: ['id'], where: { isActive: true }, required: false }],
  });
  const counts = {};
  for (const test of tests) {
    counts[test.ortPart] = (counts[test.ortPart] || 0) + (test.Questions || []).length;
  }
  return counts;
}

function estimatePreview(counts) {
  const remaining = { ...counts };
  function takeKeys(keys, count) {
    let got = 0;
    for (const key of keys) {
      const n = Math.min(count - got, remaining[key] || 0);
      remaining[key] = (remaining[key] || 0) - n;
      got += n;
    }
    return got;
  }

  const parts = MAIN_SLOTS.map((slot) => {
    const have = slot.parts.reduce((sum, key) => sum + (counts[key] || 0), 0);
    const picked = takeKeys([...slot.parts, ...slot.fallback], slot.count);
    return {
      key: slot.key,
      title: ORT_PARTS[slot.key]?.title || slot.key,
      needed: slot.count,
      have,
      picked,
    };
  });
  const questionCount = parts.reduce((sum, part) => sum + part.picked, 0);
  return {
    questionCount,
    maxQuestions: 150,
    maxScore: MAIN_MAX,
    ready: questionCount > 0,
    minutes: Math.max(20, Math.round((questionCount / 150) * 210)),
    parts,
  };
}

async function previewMainExam() {
  return estimatePreview(await countByPart());
}

async function assembleMainExam() {
  const { tests, byPart } = await loadQuestionsByPart();
  const blocks = assembleFromPools(byPart);
  const questions = blocks.flatMap((block) => block.questions);
  const preview = previewFromBlocks(blocks);

  let anchor = tests.find((row) => row.ortPart === 'analogies');
  if (!anchor) {
    const main = await Subject.findOne({ where: { name: 'Основной тест ОРТ' } });
    if (main) anchor = tests.find((row) => row.subjectId === main.id) || await Test.findOne({ where: { subjectId: main.id } });
  }
  if (!anchor) anchor = tests[0] || null;

  return { questions, preview, anchor, tests };
}

module.exports = { previewMainExam, assembleMainExam, MAIN_SLOTS };

const { Op } = require('sequelize');
const { Test, Question, Answer, QuestionTag, Subject } = require('../models');
const { pickQuestionsKeepingLinkedOrder } = require('./ortLinkedQuestions');
const { ORT_PARTS, MAIN_MAX } = require('./ortScoring');

const SIMULATION_SECTIONS = [
  {
    key: 'math',
    title: 'Математика',
    count: 60,
    minutes: 90,
    slots: [
      { parts: ['math1'], fallback: ['math', 'math2'], count: 30 },
      { parts: ['math2'], fallback: ['math', 'math1'], count: 30 },
    ],
  },
  {
    key: 'reading',
    title: 'Чтение и понимание на родном языке',
    count: 30,
    minutes: 60,
    slots: [{ parts: ['reading'], fallback: [], count: 30 }],
  },
  {
    key: 'verbal',
    title: 'Аналогии и дополнение предложений',
    count: 30,
    minutes: 30,
    slots: [
      { parts: ['analogies'], fallback: ['sentence'], count: 20 },
      { parts: ['sentence'], fallback: ['analogies'], count: 10 },
    ],
  },
  {
    key: 'grammar',
    title: 'Практическая грамматика родного языка',
    count: 30,
    minutes: 35,
    slots: [{ parts: ['grammar'], fallback: [], count: 30 }],
  },
];

const OFFICIAL_MINUTES = 215;

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

function sectionMinutes(official, picked, needed) {
  if (!picked) return 0;
  if (picked >= needed) return official;
  return Math.max(1, Math.round((official * picked) / needed));
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
  return SIMULATION_SECTIONS.map((spec) => {
    const questions = [];
    for (const slot of spec.slots) {
      let picked = take(poolFor(byPart, slot.parts), slot.count, used);
      if (picked.length < slot.count && slot.fallback.length) {
        picked = picked.concat(take(poolFor(byPart, slot.fallback), slot.count - picked.length, used));
      }
      questions.push(...picked);
    }
    const have = spec.slots.reduce((sum, slot) => sum + poolFor(byPart, slot.parts).length, 0);
    return {
      key: spec.key,
      title: spec.title,
      needed: spec.count,
      officialMinutes: spec.minutes,
      minutes: sectionMinutes(spec.minutes, questions.length, spec.count),
      have,
      questions,
    };
  });
}

function toPreview(sections) {
  const parts = sections.map((section) => ({
    key: section.key,
    title: section.title,
    needed: section.needed,
    have: section.have,
    picked: section.questions?.length ?? section.picked ?? 0,
    minutes: section.minutes,
    officialMinutes: section.officialMinutes,
  }));
  const questionCount = parts.reduce((sum, part) => sum + part.picked, 0);
  const minutes = parts.reduce((sum, part) => sum + (part.picked ? part.minutes : 0), 0);
  return {
    questionCount,
    maxQuestions: 150,
    maxScore: MAIN_MAX,
    minutes: minutes || OFFICIAL_MINUTES,
    officialMinutes: OFFICIAL_MINUTES,
    ready: questionCount > 0,
    parts,
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

  const sections = SIMULATION_SECTIONS.map((spec) => {
    const have = spec.slots.reduce((sum, slot) => (
      sum + slot.parts.reduce((inner, key) => inner + (counts[key] || 0), 0)
    ), 0);
    const picked = spec.slots.reduce((sum, slot) => (
      sum + takeKeys([...slot.parts, ...slot.fallback], slot.count)
    ), 0);
    return {
      key: spec.key,
      title: spec.title,
      needed: spec.count,
      have,
      picked,
      officialMinutes: spec.minutes,
      minutes: sectionMinutes(spec.minutes, picked, spec.count),
    };
  });
  return toPreview(sections);
}

async function previewMainExam() {
  return estimatePreview(await countByPart());
}

function sectionMeta(sections) {
  let offset = 0;
  return sections
    .filter((section) => section.questions.length)
    .map((section) => {
      const meta = {
        key: section.key,
        title: section.title,
        needed: section.needed,
        minutes: section.minutes,
        officialMinutes: section.officialMinutes,
        start: offset,
        count: section.questions.length,
      };
      offset += section.questions.length;
      return meta;
    });
}

async function assembleMainExam() {
  const { tests, byPart } = await loadQuestionsByPart();
  const assembled = assembleFromPools(byPart);
  const questions = assembled.flatMap((section) => section.questions);
  const preview = toPreview(assembled);

  let anchor = tests.find((row) => row.ortPart === 'math' || row.ortPart === 'math1');
  if (!anchor) {
    const main = await Subject.findOne({ where: { name: 'Основной тест ОРТ' } });
    if (main) {
      anchor = tests.find((row) => row.subjectId === main.id)
        || await Test.findOne({ where: { subjectId: main.id } });
    }
  }
  if (!anchor) anchor = tests[0] || null;

  return {
    questions,
    preview,
    sections: sectionMeta(assembled),
    anchor,
    tests,
  };
}

module.exports = {
  previewMainExam,
  assembleMainExam,
  SIMULATION_SECTIONS,
  ORT_PARTS,
};

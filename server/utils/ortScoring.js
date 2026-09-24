const ORT_PARTS = {
  analogies: { block: 'verbal', factor: 2, examCount: 20, title: 'Аналогии' },
  sentence: { block: 'verbal', factor: 2, examCount: 10, title: 'Дополнение предложений' },
  reading: { block: 'verbal', factor: 2, examCount: 30, title: 'Чтение и понимание' },
  grammar: { block: 'grammar', factor: 1.9, examCount: 30, title: 'Грамматика' },
  math1: { block: 'math', factor: 1.12, examCount: 30, title: 'Математика, часть 1' },
  math2: { block: 'math', factor: 1.12, examCount: 30, title: 'Математика, часть 2' },
  math: { block: 'math', factor: 1.12, examCount: 60, title: 'Математика' },
  subject: { block: 'subject', factor: 3.75, examCount: 40, title: 'Предметный тест' },
};

const BLOCKS = {
  verbal: { factor: 2, maxQuestions: 60, maxScore: 121, title: 'АДП и чтение' },
  grammar: { factor: 1.9, maxQuestions: 30, maxScore: 57, title: 'Грамматика' },
  math: { factor: 1.12, maxQuestions: 60, maxScore: 67, title: 'Математика' },
  subject: { factor: 3.75, maxQuestions: 40, maxScore: 150, title: 'Предметный тест' },
};

const MAIN_MAX = 245;
const SUBJECT_MAX = 150;

const ORT_PART_VALUES = Object.keys(ORT_PARTS);

function roundOrt(value) {
  return Math.round(Number(value) * 100) / 100;
}

function inferOrtPart(name, trackGroup) {
  const n = String(name || '').toLowerCase();
  if (trackGroup === 'subject' || /предметн/.test(n)) return 'subject';
  if (/аналог/.test(n)) return 'analogies';
  if (/дополн|предложен/.test(n)) return 'sentence';
  if (/чтени|пониман/.test(n)) return 'reading';
  if (/граммат/.test(n)) return 'grammar';
  if (/математик/.test(n) && /(2|втор)/.test(n)) return 'math2';
  if (/математик/.test(n) && /(1|перв)/.test(n)) return 'math1';
  if (/математик/.test(n)) return 'math';
  return null;
}

function normalizeOrtPart(value) {
  const key = String(value || '').trim();
  return ORT_PARTS[key] ? key : null;
}

function partMeta(ortPart) {
  return ORT_PARTS[ortPart] || null;
}

function blockPoints(correct, blockKey) {
  const block = BLOCKS[blockKey];
  if (!block) return { correct: Number(correct) || 0, points: Number(correct) || 0, factor: 1, maxScore: null };
  const raw = (Number(correct) || 0) * block.factor;
  let points = roundOrt(raw);
  if (blockKey === 'verbal' && Number(correct) >= 60) points = block.maxScore;
  if (block.maxScore != null) points = Math.min(points, block.maxScore);
  return {
    key: blockKey,
    title: block.title,
    correct: Number(correct) || 0,
    factor: block.factor,
    points,
    maxScore: block.maxScore,
  };
}

function scoreAnswers(items, examType) {
  const byBlock = { verbal: 0, grammar: 0, math: 0, subject: 0 };
  const used = new Set();
  let rawCorrect = 0;

  for (const item of items) {
    if (!item.correct) continue;
    rawCorrect += 1;
    const meta = partMeta(item.ortPart);
    const block = meta?.block;
    if (block && byBlock[block] != null) {
      used.add(block);
      byBlock[block] += 1;
    }
  }

  const breakdown = [...used].map((key) => blockPoints(byBlock[key], key));
  const officialScore = roundOrt(breakdown.reduce((sum, row) => sum + row.points, 0));
  const mainBlocks = ['verbal', 'grammar', 'math'].filter((key) => used.has(key));
  let resolvedType = examType || 'practice';
  if (!examType) {
    if (used.has('subject') && !mainBlocks.length) resolvedType = 'subject';
    else if (mainBlocks.length > 1) resolvedType = 'main';
    else if (mainBlocks.length === 1 || used.has('subject')) resolvedType = 'practice';
  }

  let maxScore = null;
  if (resolvedType === 'main') maxScore = MAIN_MAX;
  else if (resolvedType === 'subject') maxScore = SUBJECT_MAX;
  else if (used.size === 1) maxScore = BLOCKS[[...used][0]].maxScore;

  return {
    correct: rawCorrect,
    officialScore: breakdown.length ? officialScore : rawCorrect,
    maxScore,
    breakdown,
    examType: resolvedType,
  };
}

module.exports = {
  ORT_PARTS,
  ORT_PART_VALUES,
  BLOCKS,
  MAIN_MAX,
  SUBJECT_MAX,
  roundOrt,
  inferOrtPart,
  normalizeOrtPart,
  partMeta,
  blockPoints,
  scoreAnswers,
};

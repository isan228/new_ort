const { normalizeTxt, extractQuotedField } = require('./txtQuestionAnswers');

const COMPARE_KIND = 'compare';
const COMPARE_ANSWERS = [
  'Величина в колонке А больше',
  'Величина в колонке Б больше',
  'Величины равны',
  'Невозможно определить',
];

// Latin "B" is rejected on purpose: it looks like Cyrillic "В" but people also use it for column "Б".
const LETTER_INDEX = { 'А': 0, A: 0, 'Б': 1, 'В': 2, 'Г': 3 };

function compareCorrectIndex(raw) {
  const value = String(raw ?? '').trim().toUpperCase().replace(/[).\s]/g, '');
  if (/^[1-4]$/.test(value)) return Number(value) - 1;
  return value.length === 1 && value in LETTER_INDEX ? LETTER_INDEX[value] : null;
}

function compareAnswers(correctIndex) {
  return COMPARE_ANSWERS.map((text, i) => ({ text, isCorrect: i === correctIndex, sortOrder: i + 1 }));
}

function isCompare(item) {
  return item?.kind === COMPARE_KIND;
}

function field(block, ...names) {
  for (const name of names) {
    const value = extractQuotedField(block, name);
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function parseCompareFromText(text, { parseTags } = {}) {
  const items = [];
  const stats = { idBlocks: 0, missingColumns: 0, missingCorrect: 0, accepted: 0 };
  const blocks = normalizeTxt(text).split(/"ID"\s*:\s*"/i);

  for (let i = 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    stats.idBlocks += 1;
    const idMatch = block.match(/^([^"]+)"/);
    if (!idMatch) continue;

    const compareA = field(block, 'A', 'А', 'ColA');
    const compareB = field(block, 'B', 'Б', 'ColB');
    if (!compareA || !compareB) {
      stats.missingColumns += 1;
      continue;
    }
    const correct = compareCorrectIndex(field(block, 'Correct'));
    if (correct == null) {
      stats.missingCorrect += 1;
      continue;
    }
    items.push({
      kind: COMPARE_KIND,
      externalId: idMatch[1].trim(),
      text: field(block, 'Q') || '',
      compareA,
      compareB,
      explanation: field(block, 'E') || '',
      answers: compareAnswers(correct),
      tags: parseTags ? parseTags(block) : [],
    });
    stats.accepted += 1;
  }

  let hint = '';
  if (!stats.idBlocks) hint = 'В файле не найдено ни одного "ID":"...". Проверьте кавычки.';
  else if (stats.missingColumns) hint = `Без колонок "A" и "B": ${stats.missingColumns}.`;
  if (stats.missingCorrect) {
    hint += ` Без верного "Correct" (А, Б, В, Г или 1–4): ${stats.missingCorrect}.`;
  }
  items._parseStats = stats;
  items._parseHint = hint.trim();
  return items;
}

module.exports = {
  COMPARE_KIND,
  COMPARE_ANSWERS,
  compareCorrectIndex,
  compareAnswers,
  isCompare,
  parseCompareFromText,
};

const MAX_TXT_ANSWERS = 30;

function normalizeTxt(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function unescapeTxtValue(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function extractQuotedField(block, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i');
  const match = String(block || '').match(re);
  return match ? unescapeTxtValue(match[1]) : null;
}

function extractTxtAnswers(block) {
  const answers = [];
  for (let j = 1; j <= MAX_TXT_ANSWERS; j += 1) {
    const text = extractQuotedField(block, `A${j}`);
    if (text != null && String(text).trim() !== '') {
      answers.push({ text: String(text), index: j });
    }
  }
  return answers;
}

function mapAnswersWithCorrect(answers, correctRaw) {
  const correctNum = parseInt(correctRaw, 10);
  return answers.map((a) => ({
    text: a.text,
    isCorrect: a.index === correctNum,
    sortOrder: a.index,
  }));
}

function isValidCorrectIndex(answers, correctRaw) {
  const correctNum = parseInt(correctRaw, 10);
  return Number.isInteger(correctNum) && answers.some((a) => a.index === correctNum);
}

const MAX_DIFFICULTY = 4;

// Accepts 3, "3", "3/4", "★★★" or "***"; anything else means "not set".
function cleanDifficulty(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const stars = raw.match(/^[★*☆]+$/) ? (raw.match(/[★*]/g) || []).length : null;
  const n = stars ?? parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= MAX_DIFFICULTY ? n : null;
}

function extractDifficulty(block) {
  for (const name of ['Difficulty', 'Level', 'Сложность']) {
    const value = extractQuotedField(block, name);
    if (value != null) return cleanDifficulty(value);
  }
  return null;
}

module.exports = {
  MAX_DIFFICULTY,
  cleanDifficulty,
  extractDifficulty,
  MAX_TXT_ANSWERS,
  normalizeTxt,
  extractQuotedField,
  extractTxtAnswers,
  mapAnswersWithCorrect,
  isValidCorrectIndex,
};

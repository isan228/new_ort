const {
  extractQuotedField,
  extractTxtAnswers,
  mapAnswersWithCorrect,
  isValidCorrectIndex,
  normalizeTxt,
} = require('./txtQuestionAnswers');

function parseHint(stats) {
  if (stats.idBlocks === 0) {
    return 'В файле не найдено ни одного "ID":"...". Проверьте кавычки.';
  }
  if (stats.missingQ > 0 && stats.accepted === 0) {
    return `Найдено блоков ID: ${stats.idBlocks}, но нет поля "Q".`;
  }
  if (stats.missingAnswers > 0 && stats.accepted === 0) {
    return `Найдено блоков ID: ${stats.idBlocks}, но мало ответов A1/A2… (нужно ≥ 2).`;
  }
  if (stats.missingCorrect > 0 && stats.accepted === 0) {
    return `Найдено блоков ID: ${stats.idBlocks}, но нет/неверный "Correct".`;
  }
  return 'Нужны поля ID, Q, A1–A30, Correct. Объяснение E — по желанию: есть E — есть объяснение.';
}

function parseQuestionsFromText(text) {
  const questions = [];
  const stats = {
    idBlocks: 0,
    missingQ: 0,
    missingAnswers: 0,
    missingCorrect: 0,
    accepted: 0,
  };

  const blocks = normalizeTxt(text).split(/"ID"\s*:\s*"/i);

  for (let i = 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    stats.idBlocks += 1;

    const idMatch = block.match(/^([^"]+)"/);
    if (!idMatch) continue;
    const externalId = String(idMatch[1] || '').trim();

    const questionText = extractQuotedField(block, 'Q');
    if (!questionText) {
      stats.missingQ += 1;
      continue;
    }

    const answers = extractTxtAnswers(block);
    if (answers.length < 2) {
      stats.missingAnswers += 1;
      continue;
    }

    const correctRaw = extractQuotedField(block, 'Correct');
    if (!correctRaw || !isValidCorrectIndex(answers, correctRaw)) {
      stats.missingCorrect += 1;
      continue;
    }

    questions.push({
      externalId,
      text: questionText,
      explanation: String(extractQuotedField(block, 'E') || '').trim(),
      answers: mapAnswersWithCorrect(answers, correctRaw),
    });
    stats.accepted += 1;
  }

  questions._parseStats = stats;
  questions._parseHint = parseHint(stats);
  return questions;
}

function parseExplainedQuestions(raw) {
  return parseQuestionsFromText(raw);
}

module.exports = {
  parseExplainedQuestions,
  parseQuestionsFromText,
};

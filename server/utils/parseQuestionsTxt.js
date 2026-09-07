const { encodeLinkedText, QUESTION_MARK } = require('./ortLinkedQuestions');
const { normalizeTagName } = require('./ortTagNormalize');
const {
  extractQuotedField,
  extractTxtAnswers,
  mapAnswersWithCorrect,
  isValidCorrectIndex,
  normalizeTxt,
} = require('./txtQuestionAnswers');

function parseTagNames(raw) {
  if (raw == null) return [];
  return [...new Set(String(raw)
    .split(/[,;|]/)
    .map((s) => normalizeTagName(s.trim()))
    .filter(Boolean))];
}

function extractTagsFromBlock(block) {
  const tags = [];
  const seen = new Set();

  function add(name, kind) {
    const clean = normalizeTagName(name);
    if (!clean) return;
    const key = `${kind}:${clean.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    tags.push({ name: clean, kind });
  }

  add(extractQuotedField(block, 'Topic'), 'topic');
  add(extractQuotedField(block, 'Skill'), 'skill');
  add(extractQuotedField(block, 'System'), 'skill');
  add(extractQuotedField(block, 'Subject'), 'topic');

  const extra = [
    extractQuotedField(block, 'Tags'),
    extractQuotedField(block, 'T'),
    extractQuotedField(block, 'Tag'),
  ].filter(Boolean).join(',');
  parseTagNames(extra).forEach((name) => add(name, 'topic'));
  return tags;
}

function parseHint(stats, { requireExplanation, requireTags, linked }) {
  if (stats.idBlocks === 0) {
    return 'В файле не найдено ни одного "ID":"...". Проверьте кавычки.';
  }
  if (linked && stats.missingGroup > 0 && stats.accepted === 0) {
    return `Найдено блоков ID: ${stats.idBlocks}, но нет "GroupID".`;
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
  if (requireExplanation && stats.missingExplanation > 0 && stats.accepted === 0) {
    return `Найдено вопросов без поля "E" (объяснение): ${stats.missingExplanation}.`;
  }
  if (requireTags && stats.missingTags > 0 && stats.accepted === 0) {
    return `Найдено вопросов без темы/тегов (Topic/Skill или Subject/System/Tags): ${stats.missingTags}.`;
  }
  return linked
    ? 'Нужны поля GroupID, ID, Q, A1–A30, Correct, E.'
    : 'Нужны поля ID, Q, A1–A30, Correct, E и теги Topic/Skill или Subject/System/Tags.';
}

function parseQuestionsFromText(text, options = {}) {
  const {
    requireExplanation = false,
    requireTags = false,
    parseTags = true,
    linked = false,
  } = options;

  const questions = [];
  const stats = {
    idBlocks: 0,
    missingQ: 0,
    missingAnswers: 0,
    missingCorrect: 0,
    missingExplanation: 0,
    missingTags: 0,
    missingGroup: 0,
    accepted: 0,
  };

  const prepared = normalizeTxt(text);
  const blocks = prepared.split(/"ID"\s*:\s*"/i);

  for (let i = 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    stats.idBlocks += 1;

    const idMatch = block.match(/^([^"]+)"/);
    if (!idMatch) continue;
    const externalId = String(idMatch[1] || '').trim();

    let groupId = extractQuotedField(block, 'GroupID') || extractQuotedField(block, 'Group');
    if (linked && !groupId && i === 1) {
      groupId = extractQuotedField(blocks[0], 'GroupID') || extractQuotedField(blocks[0], 'Group');
    }
    if (linked && !groupId && i > 1) {
      groupId = extractQuotedField(blocks[i - 1], 'GroupID') || extractQuotedField(blocks[i - 1], 'Group');
    }
    if (linked && !groupId) {
      stats.missingGroup += 1;
      continue;
    }

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

    const explanation = extractQuotedField(block, 'E');
    if (requireExplanation && !explanation) {
      stats.missingExplanation += 1;
      continue;
    }

    const tags = parseTags ? extractTagsFromBlock(block) : [];
    if (requireTags && !tags.length) {
      stats.missingTags += 1;
      continue;
    }

    questions.push({
      externalId,
      groupId: groupId || null,
      text: linked && groupId
        ? encodeLinkedText(groupId, QUESTION_MARK, questionText)
        : questionText,
      explanation: explanation || '',
      answers: mapAnswersWithCorrect(answers, correctRaw),
      tags,
    });
    stats.accepted += 1;
  }

  questions._parseStats = stats;
  questions._parseHint = parseHint(stats, { requireExplanation, requireTags, linked });
  return questions;
}

function parseExplainedQuestions(raw, { linked = false } = {}) {
  return parseQuestionsFromText(raw, {
    linked,
    requireExplanation: false,
    requireTags: false,
    parseTags: true,
  });
}

module.exports = {
  parseExplainedQuestions,
  parseQuestionsFromText,
  extractTagsFromBlock,
};

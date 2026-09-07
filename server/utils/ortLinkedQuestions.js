const GROUP_MARK = '<<<ORT_GROUP>>>';
const QUESTION_MARK = 'QUESTION';
const VIGNETTE_MARK = 'VIGNETTE';

function encodeLinkedText(groupId, role, text) {
  return `${GROUP_MARK}\n${groupId}\n${role}\n${text}`;
}

function parseLinkedText(text) {
  if (!text || !String(text).startsWith(GROUP_MARK)) {
    return { groupId: null, role: null, displayText: text || '' };
  }
  const lines = String(text).split('\n');
  const groupId = lines[1] || null;
  const role = lines[2] || null;
  const displayText = lines.slice(3).join('\n');
  return { groupId, role, displayText };
}

function questionGroupId(question) {
  return parseLinkedText(question.text).groupId;
}

function pickQuestionsKeepingLinkedOrder(questions, limit) {
  if (!limit || questions.length <= limit) return questions.slice(0, questions.length);

  const groups = new Map();
  const order = [];

  for (const q of questions) {
    const gid = questionGroupId(q) || `solo-${q.id}`;
    if (!groups.has(gid)) {
      groups.set(gid, []);
      order.push(gid);
    }
    groups.get(gid).push(q);
  }
  for (const pack of groups.values()) {
    pack.sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
  }

  const picked = [];
  for (const gid of order) {
    const pack = groups.get(gid);
    if (picked.length > 0 && picked.length + pack.length > limit) continue;
    picked.push(...pack);
    if (picked.length >= limit) break;
  }

  if (picked.length === 0) return questions.slice(0, limit);
  return picked;
}

function publicQuestionShape(question) {
  const parsed = parseLinkedText(question.text);
  return {
    id: question.id,
    testId: question.testId,
    text: parsed.displayText,
    explanation: question.explanation,
    explanationImageUrl: question.explanationImageUrl,
    externalId: question.externalId,
    sortOrder: question.sortOrder,
    groupId: parsed.groupId,
    role: parsed.role,
    answers: (question.Answers || question.answers || []).map((a) => ({
      id: a.id,
      text: a.text,
      sortOrder: a.sortOrder,
    })),
    tags: (question.QuestionTags || question.questionTags || []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      kind: t.kind,
    })),
  };
}

function publicQuestionWithCorrect(question) {
  const base = publicQuestionShape(question);
  base.answers = (question.Answers || question.answers || []).map((a) => ({
    id: a.id,
    text: a.text,
    sortOrder: a.sortOrder,
    isCorrect: a.isCorrect,
  }));
  return base;
}

module.exports = {
  GROUP_MARK,
  QUESTION_MARK,
  VIGNETTE_MARK,
  encodeLinkedText,
  parseLinkedText,
  questionGroupId,
  pickQuestionsKeepingLinkedOrder,
  publicQuestionShape,
  publicQuestionWithCorrect,
};

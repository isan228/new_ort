const {
  Subject,
  Test,
  Question,
  Answer,
  ReadingPassage,
  SimVariant,
  SimBlock,
  SimTopic,
  SimVersion,
} = require('../models');
const { parseLinkedText } = require('./ortLinkedQuestions');
const { COMPARE_KIND } = require('./compareQuestions');

const SIM_FORMATS = ['standard', 'compare', 'reading'];
const DIFFICULTIES = ['easy', 'medium', 'above', 'hard'];

const byOrder = (a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id);

function partName(part, topic) {
  return topic ? `${part.name} · ${topic.name}` : part.name;
}

// Questions of every slot in display order: loose questions first, then each active passage with its questions.
async function loadSlotQuestions(slotIds) {
  const bySlot = new Map(slotIds.map((id) => [id, { questions: [], passages: [] }]));
  if (!slotIds.length) return bySlot;
  const [questions, passages] = await Promise.all([
    Question.findAll({ where: { testId: slotIds, isActive: true }, include: [Answer] }),
    ReadingPassage.findAll({ where: { testId: slotIds, isActive: true } }),
  ]);
  const passageById = new Map(passages.map((p) => [p.id, p]));
  const byPassage = new Map();
  for (const q of questions) {
    if (q.passageId) {
      if (!passageById.has(q.passageId)) continue;
      if (!byPassage.has(q.passageId)) byPassage.set(q.passageId, []);
      byPassage.get(q.passageId).push(q);
    } else {
      bySlot.get(q.testId)?.questions.push(q);
    }
  }
  for (const slot of bySlot.values()) slot.questions.sort(byOrder);
  for (const p of [...passages].sort(byOrder)) {
    const list = (byPassage.get(p.id) || []).sort(byOrder);
    if (!list.length) continue;
    bySlot.get(p.testId)?.passages.push({ passage: p, questions: list });
  }
  for (const slot of bySlot.values()) {
    slot.ordered = [...slot.questions, ...slot.passages.flatMap((row) => row.questions)];
  }
  return bySlot;
}

async function loadVariantTree(variantId) {
  const variant = await SimVariant.findByPk(variantId);
  if (!variant) return null;
  const subject = await Subject.findByPk(variant.subjectId);
  const blocks = (await SimBlock.findAll({ where: { variantId } })).sort(byOrder);
  const parts = blocks.length
    ? (await Test.findAll({ where: { simBlockId: blocks.map((b) => b.id), bank: 'simulation' } })).sort(byOrder)
    : [];
  const topicSlots = parts.length
    ? (await Test.findAll({ where: { parentId: parts.map((p) => p.id) }, include: [SimTopic] })).sort(byOrder)
    : [];
  const bySlot = await loadSlotQuestions([...parts, ...topicSlots].map((row) => row.id));

  const tree = blocks.map((block) => ({
    block,
    parts: parts.filter((p) => p.simBlockId === block.id).map((part) => {
      const topics = topicSlots.filter((s) => s.parentId === part.id).map((slot) => ({
        slot,
        topic: slot.SimTopic || null,
        content: bySlot.get(slot.id),
      }));
      const content = bySlot.get(part.id);
      const count = topics.length
        ? topics.reduce((sum, row) => sum + row.content.ordered.length, 0)
        : content.ordered.length;
      return { part, topics, content, count };
    }),
  }));
  return { variant, subject, tree };
}

function questionLabel(q) {
  return q.externalId ? `ID ${q.externalId}` : `№${q.id}`;
}

function questionProblem(q, format) {
  const answers = q.Answers || [];
  const correct = answers.filter((a) => a.isCorrect).length;
  if (q.kind === COMPARE_KIND) {
    if (!String(q.compareA || '').trim() || !String(q.compareB || '').trim()) return 'не заполнены колонки А и Б';
    if (answers.length !== 4) return 'у сравнения должно быть 4 ответа';
  } else {
    if (!parseLinkedText(q.text).displayText.trim() && !q.imageUrl) return 'пустое условие';
    if (answers.length < 2) return 'меньше двух вариантов ответа';
  }
  if (correct !== 1) return correct ? 'отмечено несколько правильных ответов' : 'не отмечен правильный ответ';
  if (format === 'compare' && q.kind !== COMPARE_KIND) return 'в части-сравнении обычный вопрос';
  return null;
}

// Everything a variant needs before students can take it.
function variantProblems({ tree }) {
  const problems = [];
  if (!tree.length) problems.push('В варианте нет ни одного блока');
  for (const { block, parts } of tree) {
    if (!parts.length) problems.push(`Блок «${block.title}»: нет ни одной части`);
    if (!(block.minutes > 0)) problems.push(`Блок «${block.title}»: не задано время`);
    for (const { part, topics, content, count } of parts) {
      const need = part.requiredCount || 0;
      if (!need) problems.push(`«${part.name}»: не задано число вопросов`);
      else if (count !== need) problems.push(`«${part.name}»: ${count} из ${need} вопросов`);
      const slots = topics.length ? topics.map((row) => ({ ...row, label: partName(part, row.topic) })) : [{ content, label: part.name }];
      for (const slot of slots) {
        for (const q of slot.content.ordered) {
          const issue = questionProblem(q, part.simFormat);
          if (issue) problems.push(`«${slot.label}», вопрос ${questionLabel(q)}: ${issue}`);
        }
      }
    }
  }
  return problems;
}

function snapshotQuestion(q, extra) {
  return {
    id: q.id,
    externalId: q.externalId || null,
    kind: q.kind || null,
    text: parseLinkedText(q.text).displayText,
    imageUrl: q.imageUrl || null,
    compareA: q.compareA || null,
    compareB: q.compareB || null,
    passageId: q.passageId || null,
    explanation: q.explanation || '',
    explanationImageUrl: q.explanationImageUrl || null,
    evidence: q.evidence || null,
    answers: [...(q.Answers || [])].sort(byOrder).map((a) => ({
      id: a.id,
      text: a.text,
      imageUrl: a.imageUrl || null,
      sortOrder: a.sortOrder,
      isCorrect: !!a.isCorrect,
    })),
    ...extra,
  };
}

function buildSnapshot({ variant, subject, tree }) {
  const questions = {};
  const passages = {};
  const blocks = tree.map(({ block, parts }, blockIndex) => {
    const questionIds = [];
    const partRows = parts.map(({ part, topics, content, count }) => {
      const slots = topics.length ? topics : [{ topic: null, content }];
      for (const { topic, content: slotContent } of slots) {
        for (const { passage } of slotContent.passages) {
          passages[passage.id] = { id: passage.id, title: passage.title, subtitle: passage.subtitle || '', body: passage.body };
        }
        for (const q of slotContent.ordered) {
          questionIds.push(q.id);
          questions[q.id] = snapshotQuestion(q, {
            blockIndex,
            partId: part.id,
            partName: part.name,
            topicId: topic?.id || null,
            topicName: topic?.name || null,
          });
        }
      }
      return { id: part.id, name: part.name, format: part.simFormat, count };
    });
    return { title: block.title, minutes: block.minutes, parts: partRows, questionIds };
  });
  return {
    subject: { id: subject.id, name: subject.name, trackGroup: subject.trackGroup, language: subject.language, isExtra: !!subject.isExtra },
    variant: { id: variant.id, number: variant.number, difficulty: variant.difficulty },
    blocks,
    questions,
    passages,
    questionCount: blocks.reduce((sum, b) => sum + b.questionIds.length, 0),
    minutes: blocks.reduce((sum, b) => sum + b.minutes, 0),
  };
}

async function publishVariant(variantId) {
  const loaded = await loadVariantTree(variantId);
  if (!loaded) return { error: 'Вариант не найден' };
  const problems = variantProblems(loaded);
  if (problems.length) return { problems };
  const data = buildSnapshot(loaded);
  const last = await SimVersion.max('version', { where: { variantId } });
  const version = await SimVersion.create({
    variantId,
    version: (last || 0) + 1,
    questionCount: data.questionCount,
    minutes: data.minutes,
    data,
  });
  await loaded.variant.update({ status: 'published', publishedVersionId: version.id });
  return { version };
}

module.exports = {
  SIM_FORMATS,
  DIFFICULTIES,
  byOrder,
  loadVariantTree,
  variantProblems,
  publishVariant,
};

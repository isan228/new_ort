const { Subject, Test } = require('../models');
const { inferOrtPart, normalizeOrtPart } = require('./ortScoring');

const MAIN_SECTIONS = [
  { name: 'Аналогии', ortPart: 'analogies', sortOrder: 1 },
  { name: 'Дополнение предложений', ortPart: 'sentence', sortOrder: 2 },
  { name: 'Чтение и понимание', ortPart: 'reading', sortOrder: 3 },
  { name: 'Грамматика', ortPart: 'grammar', sortOrder: 4 },
  { name: 'Математика, часть 1', ortPart: 'math1', sortOrder: 5 },
  { name: 'Математика, часть 2', ortPart: 'math2', sortOrder: 6 },
];

async function backfillOrtParts() {
  const tests = await Test.findAll({ include: [Subject] });
  for (const test of tests) {
    if (normalizeOrtPart(test.ortPart)) continue;
    const inferred = inferOrtPart(test.name, test.Subject?.trackGroup);
    if (inferred) await test.update({ ortPart: inferred });
  }
}

async function ensureOrtMainExam() {
  await backfillOrtParts();

  let subject = await Subject.findOne({ where: { name: 'Основной тест ОРТ' } });
  if (!subject) {
    subject = await Subject.create({
      name: 'Основной тест ОРТ',
      description: 'Полный основной тест: АДП и чтение, грамматика, математика. Максимум 245 баллов.',
      trackGroup: 'main',
      language: 'ru',
      sortOrder: 0,
    });
  }

  const existing = await Test.findAll({ where: { subjectId: subject.id } });
  const have = new Set(existing.map((row) => row.ortPart).filter(Boolean));

  for (const spec of MAIN_SECTIONS) {
    if (have.has(spec.ortPart)) continue;
    const sameName = existing.find((row) => row.name === spec.name);
    if (sameName) {
      await sameName.update({ ortPart: spec.ortPart, sortOrder: spec.sortOrder });
      continue;
    }
    await Test.create({
      name: spec.name,
      subjectId: subject.id,
      ortPart: spec.ortPart,
      sortOrder: spec.sortOrder,
      hasExplanations: true,
      isActive: true,
    });
  }
}

module.exports = { ensureOrtMainExam };

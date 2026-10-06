const { Op } = require('sequelize');
const { Subject, Test, Question, ReadingPassage } = require('../models');
const { inferOrtPart, normalizeOrtPart } = require('./ortScoring');
const { inferKind } = require('./sectionKinds');

const MAIN_SUBJECT = 'Основной тест ОРТ';
const LEGACY_AUTO_SECTIONS = [
  'Аналогии',
  'Дополнение предложений',
  'Чтение и понимание',
  'Грамматика',
  'Математика, часть 1',
  'Математика, часть 2',
];

async function backfillOrtParts() {
  const tests = await Test.findAll({ where: { parentId: null }, include: [Subject] });
  for (const test of tests) {
    if (normalizeOrtPart(test.ortPart)) continue;
    const inferred = inferOrtPart(test.name, test.Subject?.trackGroup);
    if (inferred) await test.update({ ortPart: inferred });
  }
}

async function contentCount(testId) {
  const [questions, passages] = await Promise.all([
    Question.count({ where: { testId } }),
    ReadingPassage.count({ where: { testId } }),
  ]);
  return questions + passages;
}

// Runs once: moves the old flat main exam (six auto-created sections) to the nested structure.
async function migrateMainSubject(subject, legacy) {
  const math = await Test.create({
    name: 'Математика',
    subjectId: subject.id,
    kind: 'group',
    ortPart: 'math',
    sortOrder: 1,
    hasExplanations: true,
    isActive: true,
  });
  await Test.create({
    name: 'Вычисления',
    subjectId: subject.id,
    parentId: math.id,
    kind: 'standard',
    ortPart: 'math',
    sortOrder: 1,
    hasExplanations: true,
    isActive: true,
  });
  await Test.create({
    name: 'Геометрия',
    subjectId: subject.id,
    parentId: math.id,
    kind: 'geometry',
    ortPart: 'math',
    sortOrder: 2,
    hasExplanations: true,
    isActive: true,
  });
  const compare = await Test.create({
    name: 'Сравнения',
    subjectId: subject.id,
    parentId: math.id,
    kind: 'compare',
    ortPart: 'math',
    sortOrder: 3,
    hasExplanations: true,
    isActive: true,
  });
  await Question.update(
    { testId: compare.id },
    { where: { testId: legacy.map((row) => row.id), kind: 'compare' } },
  );

  let reading = null;
  for (const test of legacy) {
    const filled = await contentCount(test.id);
    if (test.ortPart === 'reading' && !reading) {
      reading = test;
      await test.update({ kind: 'reading', sortOrder: 2 });
      continue;
    }
    if (!filled && LEGACY_AUTO_SECTIONS.includes(test.name)) {
      await test.destroy();
      continue;
    }
    const isMath = ['math', 'math1', 'math2'].includes(test.ortPart);
    await test.update({
      kind: inferKind(test),
      parentId: isMath ? math.id : null,
      sortOrder: isMath ? test.sortOrder + 1 : test.sortOrder + 10,
    });
  }

  if (!reading) {
    await Test.create({
      name: 'Чтение и понимание',
      subjectId: subject.id,
      kind: 'reading',
      ortPart: 'reading',
      sortOrder: 2,
      hasExplanations: true,
      isActive: true,
    });
  }
}

async function ensureOrtMainExam() {
  await backfillOrtParts();

  let subject = await Subject.findOne({ where: { name: MAIN_SUBJECT } });
  let fresh = false;
  if (!subject) {
    fresh = true;
    subject = await Subject.create({
      name: MAIN_SUBJECT,
      description: 'Полный основной тест: АДП и чтение, грамматика, математика. Максимум 245 баллов.',
      trackGroup: 'main',
      language: 'ru',
      sortOrder: 0,
    });
  }

  const legacy = await Test.findAll({ where: { kind: null } });
  const legacyMain = legacy.filter((row) => row.subjectId === subject.id);
  const structured = await Test.count({ where: { subjectId: subject.id, kind: { [Op.ne]: null } } });
  const migrateMain = fresh || (legacyMain.length > 0 && !structured);
  if (migrateMain) await migrateMainSubject(subject, legacyMain);

  for (const test of legacy) {
    if (migrateMain && test.subjectId === subject.id) continue;
    await test.update({ kind: inferKind(test) });
  }
}

module.exports = { ensureOrtMainExam };

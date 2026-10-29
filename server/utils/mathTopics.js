const { Op } = require('sequelize');
const { Subject, Test, SimTopic } = require('../models');
const { getSetting, setSetting } = require('../models/AppSetting');

// ORT maths topics: the admin picks one and uploads questions into it.
const MATH_TOPICS = [
  {
    group: 'Арифметика',
    kind: 'standard',
    topics: [
      'Числа простые и составные. Делимость, НОД, НОК, остаток',
      'Рациональные числа. Свойства арифметических действий',
      'Иррациональные выражения. Корни',
      'Положительные и отрицательные числа. Модуль',
      'Обыкновенные и десятичные дроби',
      'Отношение. Пропорции. Проценты',
      'Степень',
      'Приближённые значения. Округление',
      'Числовые неравенства и их свойства (оценка сумм)',
      'Статистика, множества (круги Эйлера), комбинаторика, вероятность',
    ],
  },
  {
    group: 'Алгебра',
    kind: 'standard',
    topics: [
      'Тождественные преобразования',
      'Алгебраические дроби',
      'Преобразование выражений с корнями',
      'Многочлены. Формулы сокращённого умножения',
      'Логарифмы и показательные выражения',
      'Уравнения (алгебраические, логарифмические, показательные, тригонометрические)',
      'Системы линейных уравнений',
      'Неравенства',
      'Функции, область определения',
      'Графики функций',
    ],
  },
  {
    group: 'Геометрия',
    kind: 'geometry',
    topics: [
      'Параллельные и перпендикулярные прямые',
      'Треугольник (свойства углов и сторон)',
      'Виды треугольников',
      'Теорема Пифагора. Тригонометрия в треугольнике (30-60-90, 45-45-90)',
      'Четырёхугольники и многоугольники',
      'Окружность и круг. Вписанные/описанные окружности',
      'Длина окружности, площадь круга',
      'Площадь и периметр многоугольников',
      'Стереометрия (площади и объёмы 3D-фигур, диагонали)',
      'Декартовы координаты. Преобразования',
    ],
  },
];

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim();

async function descendants(rootId, subjectId) {
  const all = await Test.findAll({ where: { subjectId } });
  const out = [];
  const walk = (id) => all.filter((t) => t.parentId === id).forEach((t) => { out.push(t); walk(t.id); });
  walk(rootId);
  return out;
}

// Inside `parentId`: reuse groups named Арифметика/Алгебра/Геометрия anywhere below it (e.g. under "Часть I"),
// otherwise create them; then add only the topics that are not there yet. Nothing is renamed or removed.
async function addTopics(subject, parentId, ortPart) {
  const below = parentId ? await descendants(parentId, subject.id) : await Test.findAll({ where: { subjectId: subject.id } });
  const siblings = below.filter((t) => (t.parentId || null) === (parentId || null));
  let created = 0;
  for (const [gi, spec] of MATH_TOPICS.entries()) {
    let group = below.find((t) => t.kind === 'group' && norm(t.name) === norm(spec.group));
    if (!group) {
      // A plain "Геометрия" section may already sit at this level; keep the names apart.
      const clash = siblings.some((t) => norm(t.name) === norm(spec.group));
      group = await Test.create({
        name: clash ? `${spec.group}: темы` : spec.group,
        subjectId: subject.id,
        parentId: parentId || null,
        kind: 'group',
        ortPart,
        sortOrder: 100 + gi,
        hasExplanations: true,
        isActive: true,
      });
    }
    const children = below.filter((t) => t.parentId === group.id);
    for (const [ti, name] of spec.topics.entries()) {
      if (children.some((t) => norm(t.name) === norm(name))) continue;
      await Test.create({
        name,
        subjectId: subject.id,
        parentId: group.id,
        kind: spec.kind,
        ortPart: group.ortPart || ortPart,
        sortOrder: ti + 1,
        hasExplanations: true,
        isActive: true,
      });
      created += 1;
    }
  }
  return created;
}

const DONE = (subjectId) => `mathTopics.v1:${subjectId}`;

// Simulation tests keep a flat topic dictionary per test; the group goes into the name ("Арифметика · Степень")
// so the admin can add a whole group to a part at once.
async function ensureSimMathTopics() {
  const tests = await Subject.findAll({
    where: { bank: 'simulation', [Op.or]: [{ trackGroup: 'main' }, { name: { [Op.iLike]: '%математ%' } }] },
  });
  for (const test of tests) {
    if (await getSetting(DONE(test.id))) continue;
    const existing = await SimTopic.findAll({ where: { subjectId: test.id } });
    const names = new Set(existing.map((t) => norm(t.name)));
    let order = existing.reduce((max, t) => Math.max(max, t.sortOrder || 0), 0);
    for (const spec of MATH_TOPICS) {
      for (const topic of spec.topics) {
        const name = `${spec.group} · ${topic}`;
        if (names.has(norm(name)) || names.has(norm(topic))) continue;
        order += 1;
        await SimTopic.create({ subjectId: test.id, name, sortOrder: order });
      }
    }
    await setSetting(DONE(test.id), new Date().toISOString());
  }
}

// Applied once per subject, so topics the admin deletes later do not come back.
async function ensureMathTopics() {
  const main = await Subject.findOne({ where: { name: 'Основной тест ОРТ', bank: 'practice' } });
  if (main && !await getSetting(DONE(main.id))) {
    const math = await Test.findOne({ where: { subjectId: main.id, parentId: null, kind: 'group', name: 'Математика' } })
      || await Test.findOne({ where: { subjectId: main.id, parentId: null, kind: 'group', ortPart: 'math' } });
    if (math) {
      await addTopics(main, math.id, math.ortPart || 'math');
      await setSetting(DONE(main.id), new Date().toISOString());
    }
  }
  const subjectMath = await Subject.findOne({ where: { name: 'Математика (предметный)', bank: 'practice' } });
  if (subjectMath && !await getSetting(DONE(subjectMath.id))) {
    await addTopics(subjectMath, null, null);
    await setSetting(DONE(subjectMath.id), new Date().toISOString());
  }
  await ensureSimMathTopics();
}

module.exports = { ensureMathTopics, MATH_TOPICS };

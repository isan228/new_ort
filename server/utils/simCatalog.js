const { Subject } = require('../models');

// Official ORT structure 2026 (testing.kg/tests). The admin can edit every variant after it is created.
const MAIN_BLOCKS = {
  ru: [
    { title: 'Математика, часть 1', minutes: 30, parts: [{ name: 'Математика, часть 1', format: 'compare', count: 30 }] },
    { title: 'Математика, часть 2', minutes: 60, parts: [{ name: 'Математика, часть 2', format: 'standard', count: 30 }] },
    {
      title: 'Аналогии и дополнение предложений',
      minutes: 30,
      parts: [
        { name: 'Аналогии', format: 'standard', count: 20 },
        { name: 'Дополнение предложений', format: 'standard', count: 10 },
      ],
    },
    { title: 'Чтение и понимание текста', minutes: 60, parts: [{ name: 'Чтение и понимание текста', format: 'reading', count: 30 }] },
    { title: 'Практическая грамматика', minutes: 35, parts: [{ name: 'Практическая грамматика', format: 'standard', count: 30 }] },
  ],
  ky: [
    { title: 'Математика, 1-бөлүк', minutes: 30, parts: [{ name: 'Математика, 1-бөлүк', format: 'compare', count: 30 }] },
    { title: 'Математика, 2-бөлүк', minutes: 60, parts: [{ name: 'Математика, 2-бөлүк', format: 'standard', count: 30 }] },
    {
      title: 'Аналогиялар жана сүйлөмдү толуктоо',
      minutes: 30,
      parts: [
        { name: 'Аналогиялар', format: 'standard', count: 20 },
        { name: 'Сүйлөмдү толуктоо', format: 'standard', count: 10 },
      ],
    },
    { title: 'Окуу жана түшүнүү', minutes: 60, parts: [{ name: 'Окуу жана түшүнүү', format: 'reading', count: 30 }] },
    { title: 'Практикалык грамматика', minutes: 35, parts: [{ name: 'Практикалык грамматика', format: 'standard', count: 30 }] },
  ],
};

const SUBJECT_TESTS = [
  { name: 'Математика (предметная)', count: 40, minutes: 80 },
  { name: 'Химия', count: 40, minutes: 80 },
  { name: 'Физика', count: 40, minutes: 80 },
  { name: 'Биология', count: 40, minutes: 60 },
  { name: 'История', count: 40, minutes: 60 },
  { name: 'Английский язык', count: 50, minutes: 60 },
  { name: 'Кыргызский язык и литература', count: 40, minutes: 60 },
  { name: 'Русский язык и литература', count: 40, minutes: 60 },
];

const STATE_LANG_TEST = { name: 'Тест по государственному языку', count: 50, minutes: 60 };
const DEFAULT_SUBJECT = { count: 40, minutes: 60 };

const MAIN_NAMES = { ru: 'Основной тест (русский язык)', ky: 'Основной тест (кыргызский язык)' };

function sameName(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function singleBlock(name, spec) {
  return [{ title: name, minutes: spec.minutes, parts: [{ name, format: 'standard', count: spec.count }] }];
}

function templateFor(subject) {
  if (subject.trackGroup === 'main') return MAIN_BLOCKS[subject.language === 'ky' ? 'ky' : 'ru'];
  if (subject.trackGroup === 'state_lang') return singleBlock(subject.name, STATE_LANG_TEST);
  const known = SUBJECT_TESTS.find((row) => sameName(row.name, subject.name));
  return singleBlock(subject.name, known || DEFAULT_SUBJECT);
}

// Creates the official list of simulation tests once; after that the admin owns the list.
async function ensureSimCatalog() {
  if (await Subject.count({ where: { bank: 'simulation' } })) return;
  const rows = [
    { name: MAIN_NAMES.ru, trackGroup: 'main', language: 'ru' },
    { name: MAIN_NAMES.ky, trackGroup: 'main', language: 'ky' },
    ...SUBJECT_TESTS.map((row) => ({ name: row.name, trackGroup: 'subject', language: 'any' })),
    { name: STATE_LANG_TEST.name, trackGroup: 'state_lang', language: 'ky' },
  ];
  for (const [index, row] of rows.entries()) {
    await Subject.create({ ...row, bank: 'simulation', sortOrder: index + 1, isActive: true });
  }
}

module.exports = { ensureSimCatalog, templateFor };

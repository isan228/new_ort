const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const {
  User,
  Subject,
  Test,
  Question,
  Flashcard,
} = require('../models');
const { parseExplainedQuestions } = require('./parseQuestionsTxt');
const { parseFlashcardsTxt } = require('./parseFlashcardsTxt');
const { findOrCreateTag } = require('./findOrCreateTag');
const { Answer, QuestionTagMap, FlashcardTagMap } = require('../models');

async function upsertQuestions(testId, parsed) {
  for (const item of parsed) {
    let question = item.externalId
      ? await Question.findOne({ where: { testId, externalId: item.externalId } })
      : null;
    if (!question) {
      question = await Question.create({
        testId,
        text: item.text,
        explanation: item.explanation,
        externalId: item.externalId,
      });
    }
    await Answer.destroy({ where: { questionId: question.id } });
    for (const answer of item.answers) {
      await Answer.create({ questionId: question.id, ...answer });
    }
    for (const tag of item.tags) {
      const row = await findOrCreateTag(tag.name, tag.kind);
      if (row) {
        await QuestionTagMap.findOrCreate({
          where: { questionId: question.id, tagId: row.id },
          defaults: { questionId: question.id, tagId: row.id },
        });
      }
    }
  }
}

async function seedDemoContent() {
  const { normalizeLogin } = require('./userLogin');
  const adminLogin = normalizeLogin(process.env.ADMIN_LOGIN || 'admin');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ort.kg';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  let existingAdmin = await User.findOne({
    where: { role: 'admin' },
  });
  if (!existingAdmin) {
    existingAdmin = await User.create({
      name: 'Админ ОРТ',
      login: adminLogin,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPass, 10),
      role: 'admin',
    });
  } else if (!existingAdmin.login) {
    existingAdmin.login = adminLogin;
    await existingAdmin.save();
  }

  const demoLogin = 'demo';
  const demoEmail = 'demo@ort.kg';
  let demo = await User.findOne({ where: { login: demoLogin } })
    || await User.findOne({ where: { email: demoEmail } });
  if (!demo) {
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    demo = await User.create({
      name: 'Демо ученик',
      login: demoLogin,
      email: demoEmail,
      passwordHash: await bcrypt.hash('demo123', 10),
      role: 'student',
      grade: 11,
      subscriptionEndDate: end,
    });
  } else if (!demo.login) {
    demo.login = demoLogin;
    await demo.save();
  }

  const all = await User.findAll();
  const taken = new Set(all.map((row) => row.login).filter(Boolean));
  for (const row of all) {
    if (row.login) continue;
    let candidate = normalizeLogin(row.email.split('@')[0]) || `user${row.id}`;
    if (taken.has(candidate)) candidate = `user${row.id}`;
    row.login = candidate;
    taken.add(candidate);
    await row.save();
  }

  if (await Subject.count() > 0) return;

  const banks = [
    {
      name: 'Математика (основной)',
      description: 'Арифметика, алгебра, геометрия, проценты — раздел основного теста.',
      trackGroup: 'main',
      language: 'ru',
      sortOrder: 1,
      tests: [
        { name: 'Банк: математика', file: 'sample-questions.txt' },
      ],
    },
    {
      name: 'Аналогии и предложения',
      description: 'Словесно-логический раздел: аналогии и дополнение предложений.',
      trackGroup: 'main',
      language: 'ru',
      sortOrder: 2,
      tests: [
        { name: 'Банк: аналогии', file: 'sample-analogies.txt' },
      ],
    },
    {
      name: 'Чтение и понимание',
      description: 'Тексты с группой связанных вопросов — как на настоящем ОРТ.',
      trackGroup: 'main',
      language: 'ru',
      sortOrder: 3,
      tests: [
        { name: 'Банк: чтение', file: 'sample-linked.txt', linked: true },
      ],
    },
    {
      name: 'Практическая грамматика',
      description: 'Орфография, пунктуация, морфология родного языка — раздел основного теста.',
      trackGroup: 'main',
      language: 'ru',
      sortOrder: 4,
      tests: [
        { name: 'Банк: грамматика', file: 'sample-grammar.txt' },
      ],
    },
    {
      name: 'Государственный язык',
      description: 'Обязательный тест по кыргызскому языку: лексика, грамматика, чтение.',
      trackGroup: 'state_lang',
      language: 'ky',
      sortOrder: 1,
      tests: [],
    },
    {
      name: 'Химия',
      description: 'Предметный тест для медицинских и естественно-научных направлений.',
      trackGroup: 'subject',
      language: 'ru',
      sortOrder: 1,
      tests: [
        { name: 'Банк: химия', file: 'sample-chemistry.txt' },
      ],
    },
    {
      name: 'Биология',
      description: 'Предметный тест. Вместе с химией нужен для медицины.',
      trackGroup: 'subject',
      language: 'ru',
      sortOrder: 2,
      tests: [],
    },
    {
      name: 'Физика',
      description: 'Предметный тест для технических специальностей.',
      trackGroup: 'subject',
      language: 'ru',
      sortOrder: 3,
      tests: [],
    },
    {
      name: 'Математика (предметный)',
      description: 'Профильная математика для IT, инженерии, экономики.',
      trackGroup: 'subject',
      language: 'ru',
      sortOrder: 4,
      tests: [],
    },
    {
      name: 'История',
      description: 'История Кыргызстана и всемирная история.',
      trackGroup: 'subject',
      language: 'ru',
      sortOrder: 5,
      tests: [],
    },
    {
      name: 'Английский язык',
      description: 'Грамматика и чтение предметного теста.',
      trackGroup: 'subject',
      language: 'en',
      sortOrder: 6,
      tests: [],
    },
  ];

  for (const bank of banks) {
    const subject = await Subject.create({
      name: bank.name,
      description: bank.description,
      trackGroup: bank.trackGroup,
      language: bank.language,
      sortOrder: bank.sortOrder,
    });
    const specs = bank.tests.length ? bank.tests : [{ name: `Банк: ${bank.name}` }];
    for (const spec of specs) {
      const test = await Test.create({
        name: spec.name,
        subjectId: subject.id,
        hasExplanations: true,
      });
      if (!spec.file) continue;
      const raw = fs.readFileSync(path.join(__dirname, '..', 'data', spec.file), 'utf8');
      const parsed = parseExplainedQuestions(raw, { linked: !!spec.linked });
      await upsertQuestions(test.id, parsed);
    }
  }

  if (await Flashcard.count() === 0) {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'sample-flashcards.txt'), 'utf8');
    const cards = parseFlashcardsTxt(raw);
    const mathTest = await Test.findOne({ where: { name: 'Банк: математика' } });
    for (const card of cards) {
      const row = await Flashcard.create({
        trackGroup: 'main',
        testId: mathTest ? mathTest.id : null,
        frontText: card.frontText,
        backText: card.backText,
        externalId: card.externalId,
      });
      if (card.topic) {
        const tag = await findOrCreateTag(card.topic, 'topic');
        if (tag) {
          await FlashcardTagMap.create({ flashcardId: row.id, tagId: tag.id });
        }
      }
    }
  }
}

module.exports = { seedDemoContent };

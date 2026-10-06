const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { parseLinkedText, encodeLinkedText, QUESTION_MARK } = require('../utils/ortLinkedQuestions');
const {
  Test,
  Subject,
  Question,
  Answer,
  Flashcard,
  FlashcardTagMap,
  ReadingPassage,
} = require('../models');
const { Op } = require('sequelize');
const { parseQuestionsFromText } = require('../utils/parseQuestionsTxt');
const {
  COMPARE_KIND,
  compareAnswers,
  compareCorrectIndex,
  isCompare,
  parseCompareFromText,
} = require('../utils/compareQuestions');
const { parseFlashcardsTxt } = require('../utils/parseFlashcardsTxt');
const { findOrCreateTag } = require('../utils/findOrCreateTag');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });
const fileField = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

const router = express.Router();

function readUploaded(req) {
  const file = (req.files?.pdf && req.files.pdf[0]) || (req.files?.file && req.files.file[0]);
  if (!file) return null;
  const raw = fs.readFileSync(file.path, 'utf8');
  fs.unlink(file.path, () => {});
  return raw;
}

const IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      cb(null, `q-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype] || ''}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
});

function cleanImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return null;
  if (url.startsWith('/uploads/') || /^https?:\/\//i.test(url)) return url.slice(0, 255);
  return null;
}

async function replaceAnswers(questionId, answers) {
  await Answer.destroy({ where: { questionId } });
  for (const [idx, answer] of answers.entries()) {
    await Answer.create({
      questionId,
      text: answer.text,
      imageUrl: cleanImageUrl(answer.imageUrl),
      isCorrect: !!answer.isCorrect,
      sortOrder: answer.sortOrder ?? idx + 1,
    });
  }
}

async function upsertQuestions(test, parsed, passageId = null) {
  const testId = test.id;
  let created = 0;
  let updated = 0;
  for (const item of parsed) {
    let question = item.externalId
      ? await Question.findOne({ where: { testId, passageId, externalId: item.externalId } })
      : null;
    const media = {};
    if ('imageUrl' in item) media.imageUrl = cleanImageUrl(item.imageUrl);
    if ('explanationImageUrl' in item) media.explanationImageUrl = cleanImageUrl(item.explanationImageUrl);
    if (passageId) media.passageId = passageId;
    if (item.evidence) media.evidence = String(item.evidence).trim();
    if (isCompare(item)) Object.assign(media, { kind: COMPARE_KIND, compareA: item.compareA, compareB: item.compareB });
    if (question) {
      await question.update({ text: item.text, explanation: item.explanation, isActive: true, ...media });
      updated += 1;
    } else {
      const maxOrder = await Question.max('sortOrder', { where: { testId, passageId } });
      question = await Question.create({
        testId,
        text: item.text,
        explanation: item.explanation,
        externalId: item.externalId,
        sortOrder: (maxOrder || 0) + 1,
        ...media,
      });
      created += 1;
    }
    await replaceAnswers(question.id, item.answers);
  }
  return { created, updated, total: parsed.length };
}

async function resolveTest(req) {
  if (req.body.passageId) {
    const passage = await ReadingPassage.findByPk(req.body.passageId);
    return passage ? Test.findByPk(passage.testId) : null;
  }
  if (req.body.testId) {
    return Test.findByPk(req.body.testId);
  }
  const subjectId = Number(req.body.subjectId);
  if (!subjectId) return null;
  let test = await Test.findOne({
    where: { subjectId, kind: { [Op.or]: [{ [Op.ne]: 'group' }, { [Op.is]: null }] } },
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  if (test) return test;
  const subject = await Subject.findByPk(subjectId);
  if (!subject) return null;
  return Test.create({
    name: subject.name,
    subjectId: subject.id,
    kind: 'standard',
    hasExplanations: true,
    isActive: true,
  });
}

function testError(res, test) {
  if (!test) return res.status(404).json({ error: 'Предмет или раздел не найден' });
  if (test.kind === 'group') {
    return res.status(400).json({ error: 'В разделе-группе нет вопросов — загрузите их в подраздел' });
  }
  return null;
}

async function handleQuestionTxt(req, res, options) {
  const test = await resolveTest(req);
  if (testError(res, test)) return;
  const raw = readUploaded(req);
  if (!raw) return res.status(400).json({ error: 'TXT файл не загружен. Поле: pdf или file' });
  const parsed = parseQuestionsFromText(raw, options);
  if (!parsed.length) {
    return res.status(400).json({
      error: `Не удалось найти вопросы в TXT. ${parsed._parseHint || ''}`,
      stats: parsed._parseStats || {},
    });
  }
  const stats = await upsertQuestions(test, parsed);
  res.json({
    message: `Загружено ${stats.total} вопросов (${stats.created} новых, ${stats.updated} обновлено)`,
    ...stats,
    testId: test.id,
  });
}

const PARSE_OPTIONS = {
  explained: { linked: false, requireExplanation: true, requireTags: false, parseTags: false },
  linked: { linked: true, requireExplanation: true, requireTags: false, parseTags: false },
};

router.post('/parse-txt', fileField, async (req, res) => {
  const raw = readUploaded(req);
  if (!raw) return res.status(400).json({ error: 'TXT файл не загружен' });
  if (req.body.mode === COMPARE_KIND) {
    const items = parseCompareFromText(raw);
    const stats = items._parseStats;
    if (!items.length) {
      return res.status(400).json({ error: `Не удалось найти сравнения в TXT. ${items._parseHint}`.trim(), stats });
    }
    return res.json({
      mode: COMPARE_KIND,
      items: items.map((item) => ({
        ...item,
        correct: 'АБВГ'[item.answers.findIndex((a) => a.isCorrect)],
        imageUrl: null,
        explanationImageUrl: null,
      })),
      skipped: stats.idBlocks - stats.accepted,
      hint: stats.idBlocks > stats.accepted ? items._parseHint : '',
    });
  }
  const mode = req.body.mode === 'linked' ? 'linked' : 'explained';
  const parsed = parseQuestionsFromText(raw, PARSE_OPTIONS[mode]);
  const stats = parsed._parseStats || {};
  if (!parsed.length) {
    return res.status(400).json({ error: `Не удалось найти вопросы в TXT. ${parsed._parseHint || ''}`.trim(), stats });
  }
  const items = parsed.map((item) => ({
    externalId: item.externalId,
    groupId: item.groupId || null,
    text: parseLinkedText(item.text).displayText,
    imageUrl: null,
    explanation: item.explanation || '',
    explanationImageUrl: null,
    answers: item.answers.map((a) => ({ text: a.text, isCorrect: !!a.isCorrect, imageUrl: null })),
  }));
  res.json({
    mode,
    items,
    skipped: Math.max(0, (stats.idBlocks || 0) - (stats.accepted || 0)),
    hint: stats.idBlocks > stats.accepted ? parsed._parseHint : '',
  });
});

router.post('/upload-image', imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нужна картинка: PNG, JPG, WEBP, GIF или SVG до 8 МБ' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

router.post('/import-questions', express.json({ limit: '8mb' }), async (req, res) => {
  const test = await resolveTest(req);
  if (testError(res, test)) return;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const prepared = [];
  for (const [idx, item] of items.entries()) {
    if (isCompare(item)) {
      const compareA = String(item.compareA || '').trim();
      const compareB = String(item.compareB || '').trim();
      const correct = compareCorrectIndex(item.correct);
      if (!compareA || !compareB) return res.status(400).json({ error: `Сравнение №${idx + 1}: заполните обе колонки` });
      if (correct == null) return res.status(400).json({ error: `Сравнение №${idx + 1}: выберите правильный ответ` });
      prepared.push({
        kind: COMPARE_KIND,
        compareA,
        compareB,
        externalId: item.externalId ? String(item.externalId) : null,
        text: String(item.text || '').trim(),
        imageUrl: item.imageUrl,
        explanation: String(item.explanation || ''),
        explanationImageUrl: item.explanationImageUrl,
        answers: compareAnswers(correct),
      });
      continue;
    }
    const text = String(item.text || '').trim();
    const answers = (Array.isArray(item.answers) ? item.answers : [])
      .map((a) => ({ text: String(a.text || '').trim(), imageUrl: a.imageUrl, isCorrect: !!a.isCorrect }))
      .filter((a) => a.text || a.imageUrl);
    if (!text && !item.imageUrl) return res.status(400).json({ error: `Вопрос №${idx + 1}: пустой текст` });
    if (answers.length < 2) return res.status(400).json({ error: `Вопрос №${idx + 1}: нужно минимум 2 ответа` });
    if (!answers.some((a) => a.isCorrect)) {
      return res.status(400).json({ error: `Вопрос №${idx + 1}: отметьте правильный ответ` });
    }
    const groupId = item.groupId ? String(item.groupId) : null;
    prepared.push({
      evidence: item.evidence ? String(item.evidence) : null,
      externalId: item.externalId ? String(item.externalId) : null,
      text: groupId ? encodeLinkedText(groupId, QUESTION_MARK, text || ' ') : (text || ' '),
      imageUrl: item.imageUrl,
      explanation: String(item.explanation || ''),
      explanationImageUrl: item.explanationImageUrl,
      answers: answers.map((a) => ({ ...a, text: a.text || ' ' })),
    });
  }
  if (!prepared.length) return res.status(400).json({ error: 'Нет вопросов для сохранения' });
  const stats = await upsertQuestions(test, prepared, Number(req.body.passageId) || null);
  res.json({
    message: `Сохранено ${stats.total} вопросов (${stats.created} новых, ${stats.updated} обновлено)`,
    ...stats,
    testId: test.id,
  });
});

router.post('/upload-txt-explained', fileField, async (req, res) => {
  try {
    await handleQuestionTxt(req, res, {
      linked: false,
      requireExplanation: true,
      requireTags: false,
      parseTags: false,
    });
  } catch (error) {
    console.error('Ошибка загрузки TXT:', error);
    res.status(500).json({ error: error.message || 'Ошибка обработки TXT файла' });
  }
});

router.post('/upload-txt-linked', fileField, async (req, res) => {
  try {
    await handleQuestionTxt(req, res, {
      linked: true,
      requireExplanation: true,
      requireTags: false,
      parseTags: false,
    });
  } catch (error) {
    console.error('Ошибка загрузки связанных вопросов:', error);
    res.status(500).json({ error: error.message || 'Ошибка обработки TXT файла' });
  }
});

router.post('/upload-txt-flashcards', fileField, async (req, res) => {
  const trackGroup = req.body.trackGroup || 'main';
  const testId = req.body.testId ? Number(req.body.testId) : null;
  const raw = readUploaded(req);
  if (!raw) return res.status(400).json({ error: 'Файл не получен. Поле: pdf или file' });
  const cards = parseFlashcardsTxt(raw);
  let created = 0;
  let updated = 0;

  for (const card of cards) {
    const where = { trackGroup, externalId: card.externalId };
    if (testId) where.testId = testId;
    let row = await Flashcard.findOne({ where });
    if (row) {
      await row.update({
        frontText: card.frontText,
        backText: card.backText,
        testId: testId || row.testId,
        isActive: true,
      });
      updated += 1;
    } else {
      row = await Flashcard.create({
        trackGroup,
        testId,
        frontText: card.frontText,
        backText: card.backText,
        externalId: card.externalId,
      });
      created += 1;
    }
    if (card.topic) {
      const parentTest = testId ? await Test.findByPk(testId) : null;
      const tag = await findOrCreateTag(card.topic, 'topic', parentTest?.subjectId || null);
      if (tag) {
        await FlashcardTagMap.findOrCreate({
          where: { flashcardId: row.id, tagId: tag.id },
          defaults: { flashcardId: row.id, tagId: tag.id },
        });
      }
    }
  }

  res.json({ created, updated, total: cards.length });
});

module.exports = router;

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  Test,
  Question,
  Answer,
  Flashcard,
  FlashcardTagMap,
  QuestionTagMap,
} = require('../models');
const { parseExplainedQuestions } = require('../utils/parseQuestionsTxt');
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

async function replaceAnswers(questionId, answers) {
  await Answer.destroy({ where: { questionId } });
  for (const answer of answers) {
    await Answer.create({ questionId, ...answer });
  }
}

async function attachTags(questionId, tags, subjectId = null) {
  await QuestionTagMap.destroy({ where: { questionId } });
  for (const tag of tags) {
    const row = await findOrCreateTag(tag.name, tag.kind, subjectId);
    if (row) {
      await QuestionTagMap.findOrCreate({
        where: { questionId, tagId: row.id },
        defaults: { questionId, tagId: row.id },
      });
    }
  }
}

async function upsertQuestions(test, parsed) {
  const testId = test.id;
  let created = 0;
  let updated = 0;
  for (const item of parsed) {
    let question = item.externalId
      ? await Question.findOne({ where: { testId, externalId: item.externalId } })
      : null;
    if (question) {
      await question.update({ text: item.text, explanation: item.explanation, isActive: true });
      updated += 1;
    } else {
      const maxOrder = await Question.max('sortOrder', { where: { testId } });
      question = await Question.create({
        testId,
        text: item.text,
        explanation: item.explanation,
        externalId: item.externalId,
        sortOrder: (maxOrder || 0) + 1,
      });
      created += 1;
    }
    await replaceAnswers(question.id, item.answers);
    await attachTags(question.id, item.tags, test.subjectId);
  }
  return { created, updated, total: parsed.length };
}

router.post('/upload-txt-explained', fileField, async (req, res) => {
  const test = await Test.findByPk(req.body.testId);
  if (!test) return res.status(404).json({ error: 'Тест не найден' });
  const raw = readUploaded(req);
  if (!raw) return res.status(400).json({ error: 'Файл не получен. Поле: pdf или file' });
  const parsed = parseExplainedQuestions(raw, { linked: false });
  const stats = await upsertQuestions(test, parsed);
  res.json(stats);
});

router.post('/upload-txt-linked', fileField, async (req, res) => {
  const test = await Test.findByPk(req.body.testId);
  if (!test) return res.status(404).json({ error: 'Тест не найден' });
  const raw = readUploaded(req);
  if (!raw) return res.status(400).json({ error: 'Файл не получен. Поле: pdf или file' });
  const parsed = parseExplainedQuestions(raw, { linked: true });
  const stats = await upsertQuestions(test, parsed);
  res.json(stats);
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

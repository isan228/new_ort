const fs = require('fs');
const path = require('path');
const { parseExplainedQuestions } = require('../utils/parseQuestionsTxt');
const { parseFlashcardsTxt } = require('../utils/parseFlashcardsTxt');
const { pickQuestionsKeepingLinkedOrder } = require('../utils/ortLinkedQuestions');

const data = path.join(__dirname, '..', 'data');
const math = parseExplainedQuestions(fs.readFileSync(path.join(data, 'sample-questions.txt'), 'utf8'));
const linked = parseExplainedQuestions(fs.readFileSync(path.join(data, 'sample-linked.txt'), 'utf8'), { linked: true });
const cards = parseFlashcardsTxt(fs.readFileSync(path.join(data, 'sample-flashcards.txt'), 'utf8'));

if (math.length < 5) throw new Error(`math: ${math.length}`);
if (linked.length !== 2) throw new Error(`linked: ${linked.length}`);
if (!linked[0].text.includes('<<<ORT_GROUP>>>')) throw new Error('linked marker missing');
if (cards.length < 4) throw new Error(`cards: ${cards.length}`);

const picked = pickQuestionsKeepingLinkedOrder(
  linked.map((q, i) => ({ ...q, id: i + 1, sortOrder: i + 1 })),
  1,
);
if (picked.length !== 2) throw new Error('linked group must stay together');

console.log('parsers ok', { math: math.length, linked: linked.length, cards: cards.length });

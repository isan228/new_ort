const fs = require('fs');
const path = require('path');
const { parseExplainedQuestions } = require('../utils/parseQuestionsTxt');
const { parseFlashcardsTxt } = require('../utils/parseFlashcardsTxt');

const data = path.join(__dirname, '..', 'data');
const math = parseExplainedQuestions(fs.readFileSync(path.join(data, 'sample-questions.txt'), 'utf8'));
const cards = parseFlashcardsTxt(fs.readFileSync(path.join(data, 'sample-flashcards.txt'), 'utf8'));

if (math.length < 5) throw new Error(`math: ${math.length}`);
if (cards.length < 4) throw new Error(`cards: ${cards.length}`);

const sample = parseExplainedQuestions('"ID":"1" "Q":"2+2" "A1":"3" "A2":"4" "Correct":"2" "E":"Сложение"\n"ID":"2" "Q":"3+3" "A1":"6" "A2":"7" "Correct":"1"\n"ID":"3" "Q":"1+1" "A1":"2" "A2":"3" "Correct":"1" "E":"  "');
if (sample.length !== 3) throw new Error(`sample: ${sample.length}`);
if (sample[0].explanation !== 'Сложение') throw new Error('explanation lost');
if (sample[1].explanation !== '' || sample[2].explanation !== '') throw new Error('empty explanation must stay empty');
if ('groupId' in sample[0] || 'tags' in sample[0]) throw new Error('parser must not return groupId/tags');

console.log('parsers ok', { math: math.length, cards: cards.length });

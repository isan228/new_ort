const { Op } = require('sequelize');
const { Test, Question, Answer, TestResult } = require('../models');
const { publicQuestionWithCorrect } = require('./ortLinkedQuestions');
const { scoreAnswers } = require('./ortScoring');

// Joins a question to its section and keeps only the practice bank.
const practiceTest = () => ({ model: Test, attributes: [], where: { bank: 'practice' }, required: true });

function sectionPath(test, byId) {
  const names = [test.name];
  let parent = byId.get(test.parentId);
  while (parent && names.length < 6) {
    names.unshift(parent.name);
    parent = byId.get(parent.parentId);
  }
  return names.join(' · ');
}

// Status of every question the user ever answered: the latest answer wins, skipped questions stay unanswered.
async function loadUserLastAnswers(userId) {
  const results = await TestResult.findAll({
    where: { userId },
    attributes: ['answers'],
    order: [['id', 'ASC']],
  });
  const last = new Map();
  for (const result of results) {
    for (const item of result.answers || []) {
      if (item.questionId && item.answerId) last.set(item.questionId, item.correct === true);
    }
  }
  return last;
}

async function gradeSubmission({ userId, testId, answers, durationSec, questionMode, examType }) {
  const ids = (answers || []).map((item) => item.questionId).filter(Boolean);
  const questions = await Question.findAll({
    where: { id: { [Op.in]: ids.length ? ids : [0] }, isActive: true },
    include: [{ model: Answer }, practiceTest()],
    order: [['sortOrder', 'ASC'], ['id', 'ASC'], [Answer, 'sortOrder', 'ASC']],
  });
  const tests = await Test.findAll({
    where: { id: [...new Set(questions.map((q) => q.testId))] },
  });
  const testById = new Map(tests.map((row) => [row.id, row]));
  const byId = new Map(questions.map((q) => [q.id, q]));

  let score = 0;
  const reviewed = (answers || []).map((item) => {
    const q = byId.get(item.questionId);
    const correct = q
      ? (q.Answers || []).some((a) => a.id === item.answerId && a.isCorrect)
      : false;
    if (correct) score += 1;
    const part = q ? testById.get(q.testId)?.ortPart : null;
    return {
      questionId: item.questionId,
      answerId: item.answerId,
      correct,
      ortPart: part || null,
      question: q ? publicQuestionWithCorrect(q) : null,
    };
  });

  const scoring = scoreAnswers(reviewed, examType);
  const result = await TestResult.create({
    userId,
    testId,
    score,
    officialScore: scoring.officialScore,
    scoreBreakdown: {
      examType: examType || scoring.examType,
      maxScore: scoring.maxScore,
      blocks: scoring.breakdown,
    },
    total: reviewed.length,
    questionMode: questionMode || 'all',
    answers: reviewed.map((row) => ({
      questionId: row.questionId,
      answerId: row.answerId,
      correct: row.correct,
      ortPart: row.ortPart,
    })),
    durationSec: durationSec || null,
  });

  return {
    resultId: result.id,
    score,
    officialScore: scoring.officialScore,
    maxScore: scoring.maxScore,
    breakdown: scoring.breakdown,
    examType: examType || scoring.examType,
    total: reviewed.length,
    accuracy: reviewed.length ? Math.round((score / reviewed.length) * 100) : 0,
    items: reviewed,
  };
}

module.exports = { practiceTest, sectionPath, loadUserLastAnswers, gradeSubmission };

const { sequelize } = require('../config/database');
const { User } = require('./User');
const { Subject } = require('./Subject');
const { Test } = require('./Test');
const { Question } = require('./Question');
const { Answer } = require('./Answer');
const { QuestionTag } = require('./QuestionTag');
const { QuestionTagMap } = require('./QuestionTagMap');
const { Flashcard } = require('./Flashcard');
const { FlashcardTagMap } = require('./FlashcardTagMap');
const { TermImage } = require('./TermImage');
const { SubscriptionPlan } = require('./SubscriptionPlan');
const { TestResult } = require('./TestResult');
const { Payment } = require('./Payment');

Subject.hasMany(Test, { foreignKey: 'subjectId' });
Test.belongsTo(Subject, { foreignKey: 'subjectId' });

Test.hasMany(Question, { foreignKey: 'testId' });
Question.belongsTo(Test, { foreignKey: 'testId' });

Question.hasMany(Answer, { foreignKey: 'questionId' });
Answer.belongsTo(Question, { foreignKey: 'questionId' });

Question.belongsToMany(QuestionTag, {
  through: QuestionTagMap,
  foreignKey: 'questionId',
  otherKey: 'tagId',
});
QuestionTag.belongsToMany(Question, {
  through: QuestionTagMap,
  foreignKey: 'tagId',
  otherKey: 'questionId',
});

Flashcard.belongsTo(Test, { foreignKey: 'testId' });
Test.hasMany(Flashcard, { foreignKey: 'testId' });

Flashcard.belongsToMany(QuestionTag, {
  through: FlashcardTagMap,
  foreignKey: 'flashcardId',
  otherKey: 'tagId',
});
QuestionTag.belongsToMany(Flashcard, {
  through: FlashcardTagMap,
  foreignKey: 'tagId',
  otherKey: 'flashcardId',
});

User.hasMany(TestResult, { foreignKey: 'userId' });
TestResult.belongsTo(User, { foreignKey: 'userId' });
Test.hasMany(TestResult, { foreignKey: 'testId' });
TestResult.belongsTo(Test, { foreignKey: 'testId' });

User.hasMany(Payment, { foreignKey: 'userId' });
Payment.belongsTo(User, { foreignKey: 'userId' });
Payment.belongsTo(SubscriptionPlan, { foreignKey: 'planId' });

module.exports = {
  sequelize,
  User,
  Subject,
  Test,
  Question,
  Answer,
  QuestionTag,
  QuestionTagMap,
  Flashcard,
  FlashcardTagMap,
  TermImage,
  SubscriptionPlan,
  TestResult,
  Payment,
};

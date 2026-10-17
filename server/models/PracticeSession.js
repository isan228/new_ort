const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A test built in the constructor. Questions are fixed at creation so a reload never reshuffles them.
const PracticeSession = sequelize.define('PracticeSession', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  // { testIds, difficulty, filters, count, minutes, instant }
  config: { type: DataTypes.JSONB, allowNull: false },
  // [{ questionId, testId, answerOrder: [answerId] }] in display order.
  items: { type: DataTypes.JSONB, allowNull: false },
  // Every selected topic, so topics that got no questions still show up in the results.
  topics: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  deadline: { type: DataTypes.DATE, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
  reason: { type: DataTypes.STRING(20), allowNull: true },
  resultId: { type: DataTypes.INTEGER, allowNull: true },
  result: { type: DataTypes.JSONB, allowNull: true },
}, {
  indexes: [{ fields: ['userId', 'status'] }],
});

module.exports = { PracticeSession };

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Red flag a student puts on a question; independent of whether it was answered correctly.
const QuestionFlag = sequelize.define('QuestionFlag', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  questionId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['userId', 'questionId'] }],
});

module.exports = { QuestionFlag };

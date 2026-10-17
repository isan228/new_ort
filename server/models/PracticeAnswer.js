const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PracticeAnswer = sequelize.define('PracticeAnswer', {
  sessionId: { type: DataTypes.INTEGER, allowNull: false },
  questionId: { type: DataTypes.INTEGER, allowNull: false },
  answerId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['sessionId', 'questionId'] }],
});

module.exports = { PracticeAnswer };

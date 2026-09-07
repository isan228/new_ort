const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TestResult = sequelize.define('TestResult', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  testId: { type: DataTypes.INTEGER, allowNull: false },
  score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  questionMode: { type: DataTypes.STRING, allowNull: true },
  answers: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  durationSec: { type: DataTypes.INTEGER, allowNull: true },
});

module.exports = { TestResult };

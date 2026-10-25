const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Question = sequelize.define('Question', {
  testId: { type: DataTypes.INTEGER, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  imageUrl: { type: DataTypes.STRING, allowNull: true },
  explanation: { type: DataTypes.TEXT, allowNull: true },
  explanationImageUrl: { type: DataTypes.STRING, allowNull: true },
  passageId: { type: DataTypes.INTEGER, allowNull: true },
  evidence: { type: DataTypes.TEXT, allowNull: true },
  // 'compare' = ORT quantity comparison: columns A/B with the fixed answers А–Г.
  kind: { type: DataTypes.STRING(20), allowNull: true },
  compareA: { type: DataTypes.TEXT, allowNull: true },
  compareB: { type: DataTypes.TEXT, allowNull: true },
  externalId: { type: DataTypes.STRING, allowNull: true },
  // Who added the question (by hand or from TXT): powers the editor's "Мои вопросы".
  createdById: { type: DataTypes.INTEGER, allowNull: true },
  // 1–4 stars; a question without an explicit level gets 3.
  difficulty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 3 },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { indexes: [{ fields: ['createdById'] }] });

module.exports = { Question };

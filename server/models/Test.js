const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Test = sequelize.define('Test', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  subjectId: { type: DataTypes.INTEGER, allowNull: false },
  hasExplanations: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  ortPart: { type: DataTypes.STRING, allowNull: true },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  // group = holds subsections only; standard / compare / reading = holds questions, each with its own uploader.
  kind: { type: DataTypes.STRING(20), allowNull: true },
});

module.exports = { Test };

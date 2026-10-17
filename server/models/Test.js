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
  bank: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'practice' },
  // Simulation part (top level, in a block): required question count and answer format.
  // While the part has topic children its kind is 'group' and simFormat keeps the format.
  simBlockId: { type: DataTypes.INTEGER, allowNull: true },
  requiredCount: { type: DataTypes.INTEGER, allowNull: true },
  simFormat: { type: DataTypes.STRING(20), allowNull: true },
  // Simulation topic slot (child of a part).
  simTopicId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [{ fields: ['bank'] }, { fields: ['simBlockId'] }],
});

module.exports = { Test };

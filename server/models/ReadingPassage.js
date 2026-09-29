const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReadingPassage = sequelize.define('ReadingPassage', {
  testId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(300), allowNull: false },
  subtitle: { type: DataTypes.STRING(500), allowNull: true },
  body: { type: DataTypes.TEXT, allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  indexes: [{ fields: ['testId'] }],
});

module.exports = { ReadingPassage };

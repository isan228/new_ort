const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Flashcard = sequelize.define('Flashcard', {
  trackGroup: {
    type: DataTypes.ENUM('main', 'state_lang', 'subject'),
    allowNull: false,
    defaultValue: 'main',
  },
  testId: { type: DataTypes.INTEGER, allowNull: true },
  frontText: { type: DataTypes.TEXT, allowNull: false },
  backText: { type: DataTypes.TEXT, allowNull: false },
  frontImageUrl: { type: DataTypes.STRING, allowNull: true },
  backImageUrl: { type: DataTypes.STRING, allowNull: true },
  externalId: { type: DataTypes.STRING, allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

module.exports = { Flashcard };

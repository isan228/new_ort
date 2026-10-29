const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subject = sequelize.define('Subject', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  trackGroup: {
    type: DataTypes.ENUM('main', 'state_lang', 'subject'),
    allowNull: false,
    defaultValue: 'main',
  },
  language: {
    type: DataTypes.ENUM('ru', 'ky', 'en', 'any'),
    allowNull: false,
    defaultValue: 'ru',
  },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // practice = builder/flashcards/random main exam; simulation = fixed variants. The two never mix.
  bank: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'practice' },
  // Simulation course that is not an official ORT subject test (e.g. German).
  isExtra: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Editor who created this subject: it is theirs to structure; null = created by the admin.
  createdById: { type: DataTypes.INTEGER, allowNull: true },
});

module.exports = { Subject };

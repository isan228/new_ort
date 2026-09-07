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
});

module.exports = { Subject };

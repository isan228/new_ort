const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.ENUM('student', 'admin'), allowNull: false, defaultValue: 'student' },
  language: { type: DataTypes.ENUM('ru', 'ky'), allowNull: false, defaultValue: 'ru' },
  grade: { type: DataTypes.INTEGER, allowNull: true },
  subscriptionEndDate: { type: DataTypes.DATE, allowNull: true },
});

module.exports = { User };

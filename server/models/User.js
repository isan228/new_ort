const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  login: { type: DataTypes.STRING, allowNull: true, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.ENUM('student', 'admin'), allowNull: false, defaultValue: 'student' },
  language: { type: DataTypes.ENUM('ru', 'ky'), allowNull: false, defaultValue: 'ru' },
  grade: { type: DataTypes.INTEGER, allowNull: true },
  subscriptionEndDate: { type: DataTypes.DATE, allowNull: true },
  subscriptionPlanId: { type: DataTypes.INTEGER, allowNull: true },
  referralCode: { type: DataTypes.STRING, allowNull: true, unique: true },
  referredById: { type: DataTypes.INTEGER, allowNull: true },
  referralBonusGranted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

module.exports = { User };

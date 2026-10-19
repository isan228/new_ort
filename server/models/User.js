const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { loginKey } = require('../utils/userLogin');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  login: { type: DataTypes.STRING, allowNull: true, unique: true },
  loginKey: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.ENUM('student', 'admin', 'editor'), allowNull: false, defaultValue: 'student' },
  language: { type: DataTypes.ENUM('ru', 'ky'), allowNull: false, defaultValue: 'ru' },
  grade: { type: DataTypes.INTEGER, allowNull: true },
  subscriptionEndDate: { type: DataTypes.DATE, allowNull: true },
  subscriptionPlanId: { type: DataTypes.INTEGER, allowNull: true },
  referralCode: { type: DataTypes.STRING, allowNull: true, unique: true },
  referredById: { type: DataTypes.INTEGER, allowNull: true },
  referralBonusGranted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  coins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  referralCoinsGranted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // UGC / blogger account created by the admin: full access with no end date, tracked by referrals.
  isUgc: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Switched off by the admin: the account keeps its type and stats but loses free access.
  ugcDisabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  ugcNote: { type: DataTypes.STRING(300), allowNull: true },
}, {
  indexes: [{ fields: ['loginKey'] }],
  hooks: {
    beforeSave(user) {
      if (user.changed('login') || !user.loginKey) {
        user.loginKey = user.login ? loginKey(user.login) : null;
      }
    },
  },
});

module.exports = { User };

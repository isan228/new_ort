const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  userId: { type: DataTypes.INTEGER, allowNull: true },
  planId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ort_subscription' },
  status: { type: DataTypes.ENUM('pending', 'paid', 'failed'), allowNull: false, defaultValue: 'pending' },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  months: { type: DataTypes.INTEGER, allowNull: false },
  providerRef: { type: DataTypes.STRING, allowNull: true },
  // Registration data (with password hash) kept until the payment succeeds and the account is created.
  signup: { type: DataTypes.JSONB, allowNull: true },
  claimToken: { type: DataTypes.STRING(80), allowNull: true },
  promoCodeId: { type: DataTypes.INTEGER, allowNull: true },
  discount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  coinsUsed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = { Payment };

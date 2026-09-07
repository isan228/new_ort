const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  planId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ort_subscription' },
  status: { type: DataTypes.ENUM('pending', 'paid', 'failed'), allowNull: false, defaultValue: 'pending' },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  months: { type: DataTypes.INTEGER, allowNull: false },
  providerRef: { type: DataTypes.STRING, allowNull: true },
});

module.exports = { Payment };

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CoinTransaction = sequelize.define('CoinTransaction', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING(40), allowNull: false },
  paymentId: { type: DataTypes.INTEGER, allowNull: true },
  relatedUserId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [{ fields: ['userId'] }],
});

module.exports = { CoinTransaction };

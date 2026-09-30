const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PromoCode = sequelize.define('PromoCode', {
  code: { type: DataTypes.STRING(40), allowNull: false },
  discountType: { type: DataTypes.ENUM('percent', 'fixed'), allowNull: false, defaultValue: 'percent' },
  discountValue: { type: DataTypes.INTEGER, allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: true },
  endsAt: { type: DataTypes.DATE, allowNull: true },
  // null means unlimited.
  maxUses: { type: DataTypes.INTEGER, allowNull: true },
  usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // null means every plan.
  planIds: { type: DataTypes.JSONB, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  note: { type: DataTypes.STRING(300), allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['code'] }],
});

module.exports = { PromoCode };

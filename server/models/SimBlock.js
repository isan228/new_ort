const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One timed block of a variant. Its parts are Test rows (bank = simulation) pointing here via simBlockId.
const SimBlock = sequelize.define('SimBlock', {
  variantId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(300), allowNull: false },
  minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  indexes: [{ fields: ['variantId'] }],
});

module.exports = { SimBlock };

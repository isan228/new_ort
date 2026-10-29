const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Schools of Kyrgyzstan: imported from bilim.akipress.org (sourceId) or added by the admin.
const School = sequelize.define('School', {
  name: { type: DataTypes.STRING(300), allowNull: false },
  address: { type: DataTypes.STRING(500), allowNull: true },
  region: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(160), allowNull: true },
  // bilim | manual
  source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual' },
  sourceId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  // An admin edit wins over later imports of the same school.
  editedByAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { indexes: [{ fields: ['region', 'district'] }, { fields: ['name'] }] });

module.exports = { School };

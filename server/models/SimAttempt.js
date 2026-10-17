const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SimAttempt = sequelize.define('SimAttempt', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  variantId: { type: DataTypes.INTEGER, allowNull: false },
  versionId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  blockIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // Per block: { title, minutes, count, startedAt, closedAt, reason: 'manual' | 'timeout' | 'finish' }.
  blocks: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  // Subject name, variant number, difficulty, totals — so lists never load the snapshot.
  meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  result: { type: DataTypes.JSONB, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ fields: ['userId'] }, { fields: ['variantId'] }],
});

module.exports = { SimAttempt };

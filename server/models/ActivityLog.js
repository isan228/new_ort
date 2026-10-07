const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
  userId: { type: DataTypes.INTEGER, allowNull: true },
  userName: { type: DataTypes.STRING, allowNull: true },
  userRole: { type: DataTypes.STRING(20), allowNull: true },
  action: { type: DataTypes.STRING(20), allowNull: false },
  entity: { type: DataTypes.STRING(20), allowNull: false },
  entityId: { type: DataTypes.INTEGER, allowNull: true },
  testId: { type: DataTypes.INTEGER, allowNull: true },
  place: { type: DataTypes.STRING(500), allowNull: true },
  summary: { type: DataTypes.TEXT, allowNull: true },
  details: { type: DataTypes.JSONB, allowNull: true },
}, {
  indexes: [{ fields: ['userId'] }, { fields: ['createdAt'] }],
});

module.exports = { ActivityLog };

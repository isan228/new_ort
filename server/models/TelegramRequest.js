const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Need a person on date X" posted by the bot to the group; the first "I can" takes it.
const TelegramRequest = sequelize.define('TelegramRequest', {
  date: { type: DataTypes.DATEONLY, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  // open → taken | cancelled
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'open' },
  creatorTgId: { type: DataTypes.BIGINT, allowNull: false },
  creatorName: { type: DataTypes.STRING(200), allowNull: true },
  creatorUsername: { type: DataTypes.STRING(100), allowNull: true },
  takerTgId: { type: DataTypes.BIGINT, allowNull: true },
  takerName: { type: DataTypes.STRING(200), allowNull: true },
  takerUsername: { type: DataTypes.STRING(100), allowNull: true },
  takenAt: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
  cancelledBy: { type: DataTypes.STRING(200), allowNull: true },
  groupChatId: { type: DataTypes.BIGINT, allowNull: true },
  groupMessageId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [{ fields: ['status'] }, { fields: ['date'] }, { fields: ['creatorTgId'] }, { fields: ['takerTgId'] }],
});

module.exports = { TelegramRequest };

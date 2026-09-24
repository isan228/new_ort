const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  authorId: { type: DataTypes.INTEGER, allowNull: false },
  fromAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  readAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [
    { fields: ['userId'] },
    { fields: ['fromAdmin', 'readAt'] },
  ],
});

module.exports = { ChatMessage };

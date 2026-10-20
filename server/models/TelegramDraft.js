const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Where a user is in the "new request" dialog with the bot; kept in the DB so a restart does not lose it.
const TelegramDraft = sequelize.define('TelegramDraft', {
  tgUserId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  step: { type: DataTypes.STRING(20), allowNull: false },
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
});

module.exports = { TelegramDraft };

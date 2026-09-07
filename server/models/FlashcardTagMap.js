const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlashcardTagMap = sequelize.define('FlashcardTagMap', {
  flashcardId: { type: DataTypes.INTEGER, allowNull: false },
  tagId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['flashcardId', 'tagId'] }],
});

module.exports = { FlashcardTagMap };

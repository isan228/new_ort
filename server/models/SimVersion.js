const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Frozen copy of a variant made on publish: structure, questions, correct answers and explanations.
// Kept after the variant is edited or deleted so saved attempts stay intact.
const SimVersion = sequelize.define('SimVersion', {
  variantId: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  questionCount: { type: DataTypes.INTEGER, allowNull: false },
  minutes: { type: DataTypes.INTEGER, allowNull: false },
  data: { type: DataTypes.JSONB, allowNull: false },
}, {
  indexes: [{ fields: ['variantId'] }],
});

module.exports = { SimVersion };

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SimAnswer = sequelize.define('SimAnswer', {
  attemptId: { type: DataTypes.INTEGER, allowNull: false },
  questionId: { type: DataTypes.INTEGER, allowNull: false },
  answerId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['attemptId', 'questionId'] }],
});

module.exports = { SimAnswer };

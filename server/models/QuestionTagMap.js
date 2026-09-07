const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuestionTagMap = sequelize.define('QuestionTagMap', {
  questionId: { type: DataTypes.INTEGER, allowNull: false },
  tagId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['questionId', 'tagId'] }],
});

module.exports = { QuestionTagMap };

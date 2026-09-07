const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuestionTag = sequelize.define('QuestionTag', {
  name: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  kind: { type: DataTypes.ENUM('topic', 'skill'), allowNull: false, defaultValue: 'topic' },
  subjectId: { type: DataTypes.INTEGER, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

module.exports = { QuestionTag };

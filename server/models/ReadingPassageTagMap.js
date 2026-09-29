const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReadingPassageTagMap = sequelize.define('ReadingPassageTagMap', {
  passageId: { type: DataTypes.INTEGER, allowNull: false },
  tagId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['passageId', 'tagId'] }],
});

module.exports = { ReadingPassageTagMap };

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Topic dictionary of one simulation test: the same topic id in different blocks is merged in the results.
const SimTopic = sequelize.define('SimTopic', {
  subjectId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(300), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  indexes: [{ fields: ['subjectId'] }],
});

module.exports = { SimTopic };

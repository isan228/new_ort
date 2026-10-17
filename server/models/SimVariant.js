const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SimVariant = sequelize.define('SimVariant', {
  subjectId: { type: DataTypes.INTEGER, allowNull: false },
  number: { type: DataTypes.INTEGER, allowNull: false },
  // easy / medium / above / hard
  difficulty: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'medium' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
  // Students always take this frozen snapshot, never the live structure.
  publishedVersionId: { type: DataTypes.INTEGER, allowNull: true },
  allowRetake: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  indexes: [{ fields: ['subjectId'] }],
});

module.exports = { SimVariant };

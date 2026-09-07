const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TermImage = sequelize.define('TermImage', {
  imageUrl: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  keywords: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

module.exports = { TermImage };

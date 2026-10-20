const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AppSetting = sequelize.define('AppSetting', {
  key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  value: { type: DataTypes.TEXT, allowNull: true },
});

async function getSetting(key) {
  const row = await AppSetting.findOne({ where: { key } });
  return row ? row.value : null;
}

async function setSetting(key, value) {
  const [row] = await AppSetting.findOrCreate({ where: { key }, defaults: { key, value } });
  if (row.value !== value) await row.update({ value });
}

module.exports = { AppSetting, getSetting, setSetting };

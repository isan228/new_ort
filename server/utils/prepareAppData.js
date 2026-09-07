const { sequelize } = require('../models');
const { ensureOrtTagsSeeded } = require('./ensureOrtTagsSeeded');
const { ensurePlansForOrt } = require('./subscriptionPlans');
const { seedDemoContent } = require('./seedDemo');

async function prepareAppData() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await ensureOrtTagsSeeded();
  await ensurePlansForOrt();
  await seedDemoContent();
}

module.exports = { prepareAppData };

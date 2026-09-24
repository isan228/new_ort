const { sequelize } = require('../models');
const { ensureOrtTagsSeeded } = require('./ensureOrtTagsSeeded');
const { ensurePlansForOrt } = require('./subscriptionPlans');
const { seedDemoContent } = require('./seedDemo');
const { ensureOrtMainExam } = require('./ensureOrtMainExam');
const { ensureReferralCodes } = require('./referral');

async function prepareAppData() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await ensureOrtTagsSeeded();
  await ensurePlansForOrt();
  await seedDemoContent();
  await ensureOrtMainExam();
  await ensureReferralCodes();
}

module.exports = { prepareAppData };

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { sequelize } = require('../models');
const { ensureOrtTagsSeeded } = require('../utils/ensureOrtTagsSeeded');
const { ensurePlansForOrt } = require('../utils/subscriptionPlans');
const { seedDemoContent } = require('../utils/seedDemo');

(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await ensureOrtTagsSeeded();
  await ensurePlansForOrt();
  await seedDemoContent();
  console.log('Сиды готовы');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

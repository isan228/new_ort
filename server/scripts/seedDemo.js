require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { ensureDatabase } = require('../utils/ensureDatabase');
const { prepareAppData } = require('../utils/prepareAppData');
const { sequelize } = require('../models');

(async () => {
  await ensureDatabase();
  await prepareAppData();
  await sequelize.close();
  console.log('Сиды готовы');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

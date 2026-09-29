require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { sequelize, SubscriptionPlan } = require('../models');
const { ensurePlansForOrt } = require('../utils/subscriptionPlans');

function print(title, plans) {
  console.log(`${title}: ${plans.length}`);
  if (plans.length) {
    console.table(plans.map((p) => ({
      id: p.id, title: p.title, months: p.months, price: p.price, isActive: p.isActive,
    })));
  }
}

async function main() {
  await sequelize.authenticate();
  console.log('База:', sequelize.config.database, '@', sequelize.config.host);
  print('Тарифов до', await SubscriptionPlan.findAll({ raw: true, order: [['id', 'ASC']] }));
  await ensurePlansForOrt();
  print('Тарифов после', await SubscriptionPlan.findAll({ raw: true, order: [['id', 'ASC']] }));
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

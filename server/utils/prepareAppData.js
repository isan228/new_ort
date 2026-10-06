const { Op } = require('sequelize');
const { sequelize, User } = require('../models');
const { loginKey } = require('./userLogin');

async function fillLoginKeys() {
  const users = await User.findAll({ where: { loginKey: null, login: { [Op.ne]: null } } });
  for (const user of users) {
    await User.update({ loginKey: loginKey(user.login) }, { where: { id: user.id }, hooks: false });
  }
}
const { ensurePlansForOrt } = require('./subscriptionPlans');
const { seedDemoContent } = require('./seedDemo');
const { ensureOrtMainExam } = require('./ensureOrtMainExam');
const { ensureReferralCodes } = require('./referral');

async function prepareAppData() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  // sync({ alter }) does not drop NOT NULL on columns that carry a foreign key.
  await sequelize.query('ALTER TABLE "Payments" ALTER COLUMN "userId" DROP NOT NULL');
  await fillLoginKeys();
  await ensurePlansForOrt();
  await seedDemoContent();
  await ensureOrtMainExam();
  await ensureReferralCodes();
}

module.exports = { prepareAppData };

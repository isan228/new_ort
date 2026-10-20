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
const { ensureSimCatalog } = require('./simCatalog');

async function prepareAppData() {
  await sequelize.authenticate();
  // sync({ alter }) cannot add a value to an existing Postgres ENUM; the type is missing only on a fresh DB.
  await sequelize.query(`ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'editor'`).catch(() => {});
  await sequelize.sync({ alter: true });
  // sync({ alter }) does not drop NOT NULL on columns that carry a foreign key.
  await sequelize.query('ALTER TABLE "Payments" ALTER COLUMN "userId" DROP NOT NULL');
  // Tables of the group-request bot that Student Bot replaced.
  await sequelize.query('DROP TABLE IF EXISTS "TelegramRequests", "TelegramDrafts"');
  await fillLoginKeys();
  await ensurePlansForOrt();
  await seedDemoContent();
  await ensureOrtMainExam();
  await ensureSimCatalog();
  await ensureReferralCodes();
}

module.exports = { prepareAppData };

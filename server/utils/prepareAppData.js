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

// Questions added before Question.createdById existed get their author from the editor journal.
// Only rows still without an author are touched, so this is a no-op once everything is filled.
async function backfillQuestionAuthors() {
  await sequelize.query(`UPDATE "Questions" q SET "createdById" = l."userId"
    FROM "ActivityLogs" l
    WHERE l.action = 'create' AND l.entity = 'question' AND l."entityId" = q.id
      AND l."userId" IS NOT NULL AND q."createdById" IS NULL`);
  await sequelize.query(`UPDATE "Questions" q SET "createdById" = l."userId"
    FROM "ActivityLogs" l, jsonb_array_elements_text(COALESCE(l.details->'questionIds', '[]'::jsonb)) AS e(id)
    WHERE l.action = 'import' AND q.id = e.id::int AND l."userId" IS NOT NULL AND q."createdById" IS NULL`);
  // Older imports only recorded the section and time: their questions were created moments before the entry.
  await sequelize.query(`UPDATE "Questions" q SET "createdById" = l."userId"
    FROM "ActivityLogs" l
    WHERE l.action = 'import' AND l."userId" IS NOT NULL AND q."createdById" IS NULL
      AND jsonb_array_length(COALESCE(l.details->'questionIds', '[]'::jsonb)) = 0
      AND q."testId" = l."testId"
      AND q."createdAt" BETWEEN l."createdAt" - interval '2 minutes' AND l."createdAt"`);
}

async function prepareAppData() {
  await sequelize.authenticate();
  // sync({ alter }) cannot add a value to an existing Postgres ENUM; the type is missing only on a fresh DB.
  await sequelize.query(`ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'editor'`).catch(() => {});
  await sequelize.sync({ alter: true });
  // sync({ alter }) does not drop NOT NULL on columns that carry a foreign key.
  await sequelize.query('ALTER TABLE "Payments" ALTER COLUMN "userId" DROP NOT NULL');
  // Tables of the group-request bot that Student Bot replaced.
  await sequelize.query('DROP TABLE IF EXISTS "TelegramRequests", "TelegramDrafts"');
  // The scale is 1–4 stars; questions without a level (or left with 5 from the old scale) get the default 3.
  await sequelize.query('UPDATE "Questions" SET difficulty = 3 WHERE difficulty IS NULL OR difficulty NOT BETWEEN 1 AND 4');
  await backfillQuestionAuthors();
  await fillLoginKeys();
  await ensurePlansForOrt();
  await seedDemoContent();
  await ensureOrtMainExam();
  await ensureSimCatalog();
  await ensureReferralCodes();
}

module.exports = { prepareAppData };

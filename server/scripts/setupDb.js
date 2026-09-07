const fs = require('fs');
const path = require('path');

const rootEnv = path.join(__dirname, '..', '..', '.env');
const exampleEnv = path.join(__dirname, '..', '..', '.env.example');

if (!fs.existsSync(rootEnv) && fs.existsSync(exampleEnv)) {
  fs.copyFileSync(exampleEnv, rootEnv);
  console.log('Создан .env из .env.example — при необходимости поправь пароль Postgres');
}

require('dotenv').config({ path: rootEnv });

const { ensureDatabase } = require('../utils/ensureDatabase');
const { prepareAppData } = require('../utils/prepareAppData');
const { sequelize } = require('../models');

(async () => {
  const target = await ensureDatabase();
  console.log(`Подключаюсь: ${target.user}@${target.host}:${target.port}/${target.database}`);
  await prepareAppData();
  await sequelize.close();
  console.log('Готово: база, таблицы, теги, тарифы и демо-данные');
  process.exit(0);
})().catch((err) => {
  console.error('Не удалось настроить базу.');
  console.error(err.message || err);
  console.error('Нужен запущенный PostgreSQL. Локально часто: пользователь postgres, пароль postgres.');
  console.error('Суперпользователь можно задать так: POSTGRES_USER=postgres POSTGRES_PASSWORD=пароль npm run setup:db');
  process.exit(1);
});

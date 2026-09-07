const { spawnSync } = require('child_process');
const { Client } = require('pg');
const {
  parseDatabaseUrl,
  assertSafeIdent,
  quoteIdent,
  quoteLiteral,
} = require('./parseDatabaseUrl');

function adminTargets(target) {
  const adminUser = process.env.POSTGRES_USER || 'postgres';
  const adminPassword = process.env.POSTGRES_PASSWORD
    ?? (target.user === 'postgres' ? target.password : 'postgres');
  const hosts = [...new Set([target.host, '127.0.0.1', 'localhost'])];

  return hosts.map((host) => ({
    user: adminUser,
    password: adminPassword,
    host,
    port: target.port,
    database: 'postgres',
  }));
}

async function tryConnect(cfg) {
  const client = new Client({
    user: cfg.user,
    password: cfg.password,
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    connectionTimeoutMillis: 4000,
  });
  await client.connect();
  return client;
}

function runPsql(sql, database = 'postgres') {
  const attempts = [
    ['sudo', ['-n', '-u', 'postgres', 'psql', '-d', database, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]],
    ['psql', ['-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]],
  ];
  for (const [cmd, args] of attempts) {
    const result = spawnSync(cmd, args, { encoding: 'utf8' });
    if (result.status === 0) return { ok: true, stdout: String(result.stdout || '').trim() };
  }
  return { ok: false, stdout: '' };
}

async function applySql(admin, statements, database = 'postgres') {
  if (admin) {
    for (const sql of statements) {
      await admin.query(sql);
    }
    return;
  }
  for (const sql of statements) {
    const result = runPsql(sql, database);
    if (!result.ok) {
      throw new Error(`Не удалось выполнить SQL через psql: ${sql}`);
    }
  }
}

async function openAdmin(target) {
  for (const cfg of adminTargets(target)) {
    try {
      const client = await tryConnect(cfg);
      return { client, cfg };
    } catch (_) {
      // пробуем следующий хост
    }
  }
  return { client: null, cfg: adminTargets(target)[0] };
}

async function grantPublicSchema(adminCfg, target) {
  const role = quoteIdent(target.user);
  const statements = [
    `GRANT ALL ON SCHEMA public TO ${role}`,
    `ALTER SCHEMA public OWNER TO ${role}`,
  ];
  if (!adminCfg) {
    await applySql(null, statements, target.database);
    return;
  }
  const schemaAdmin = await tryConnect({ ...adminCfg, database: target.database });
  try {
    await applySql(schemaAdmin, statements, target.database);
  } finally {
    await schemaAdmin.end();
  }
}

async function ensureDatabase() {
  const target = parseDatabaseUrl();
  assertSafeIdent(target.database, 'базы');
  assertSafeIdent(target.user, 'пользователя');

  try {
    const ready = await tryConnect(target);
    await ready.end();
    console.log(`База ${target.database} уже есть`);
    return target;
  } catch (err) {
    console.log(`Базы ещё нет или нет доступа (${err.code || err.message}). Создаю…`);
  }

  const opened = await openAdmin(target);
  const admin = opened.client;
  if (!admin) {
    console.log('TCP-вход суперпользователем не вышел, пробую psql / sudo -u postgres');
  }

  const db = quoteIdent(target.database);
  const role = quoteIdent(target.user);
  const pass = quoteLiteral(target.password || 'postgres');

  try {
    await applySql(admin, [
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(target.user)}) THEN
          CREATE ROLE ${role} LOGIN PASSWORD ${pass};
        ELSE
          ALTER ROLE ${role} WITH LOGIN PASSWORD ${pass};
        END IF;
      END $$;`,
    ]);

    let exists = false;
    if (admin) {
      const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [target.database]);
      exists = found.rowCount > 0;
    } else {
      const found = runPsql(`SELECT 1 FROM pg_database WHERE datname = ${quoteLiteral(target.database)}`);
      exists = found.ok && found.stdout.startsWith('1');
    }

    if (!exists) {
      await applySql(admin, [
        `CREATE DATABASE ${db} OWNER ${role} ENCODING 'UTF8' TEMPLATE template0`,
      ]);
      console.log(`Создана база ${target.database}, владелец ${target.user}`);
    } else {
      await applySql(admin, [`ALTER DATABASE ${db} OWNER TO ${role}`]);
      console.log(`База ${target.database} уже была, владелец обновлён`);
    }

    await applySql(admin, [
      `GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${role}`,
    ]);
  } finally {
    if (admin) await admin.end();
  }

  await grantPublicSchema(admin ? opened.cfg : null, target);

  const check = await tryConnect(target);
  await check.end();
  return target;
}

module.exports = { ensureDatabase, parseDatabaseUrl };

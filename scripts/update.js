const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SKIP_DB = process.argv.includes('--skip-db');
const SKIP_PULL = process.argv.includes('--skip-pull');

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.silent ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    const err = opts.silent ? String(result.stderr || result.stdout || '').trim() : '';
    throw new Error(err || `${cmd} ${args.join(' ')} завершился с кодом ${result.status}`);
  }
  return result;
}

if (process.platform === 'win32') {
  console.error('npm run update — только на Linux-сервере, после git push с компьютера.');
  process.exit(1);
}

if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('Запусти от root: sudo npm run update');
  process.exit(1);
}

const envFile = path.join(ROOT, '.env');
if (!fs.existsSync(envFile)) {
  console.error('Нет .env — сначала скопируй .env.example и заполни DATABASE_URL.');
  process.exit(1);
}

console.log('Обновление ORT.KG в', ROOT);

function git(args, opts) {
  return run('git', ['-c', `safe.directory=${ROOT}`, ...args], opts);
}

// The server is only a deploy target: it must match origin/main exactly.
// Local commits or edits are kept in a backup branch / stash instead of blocking the update.
if (!SKIP_PULL) {
  git(['fetch', 'origin', 'main']);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const dirty = String(git(['status', '--porcelain', '--untracked-files=no'], { silent: true }).stdout).trim();
  if (dirty) {
    git(['stash', 'push', '-m', `update-backup-${stamp}`]);
    console.warn(`Локальные правки на сервере сохранены в git stash (update-backup-${stamp})`);
  }
  const ahead = Number(String(git(['rev-list', '--count', 'origin/main..HEAD'], { silent: true }).stdout).trim()) || 0;
  if (ahead > 0) {
    git(['branch', `backup/server-${stamp}`, 'HEAD']);
    console.warn(`На сервере было ${ahead} своих коммитов — сохранены в ветке backup/server-${stamp}`);
  }
  git(['reset', '--hard', 'origin/main']);
}

run('npm', ['install']);
run('npm', ['run', 'install:all']);

if (!SKIP_DB) {
  try {
    run('npm', ['run', 'setup:db']);
  } catch (err) {
    console.warn('База не обновилась (сервис при старте всё равно синхронизирует схему):', err.message);
  }
}

run('npm', ['run', 'build']);

if (fs.existsSync('/usr/sbin/nologin') || fs.existsSync('/etc/passwd')) {
  try {
    run('id', ['-u', 'www-data'], { silent: true });
    run('chown', ['-R', 'www-data:www-data', ROOT]);
    run('chmod', ['640', envFile]);
  } catch (_) {
    console.warn('www-data нет — права не менял');
  }
}

if (fs.existsSync('/etc/systemd/system/ort-2026.service')) {
  run('systemctl', ['daemon-reload']);
  run('systemctl', ['restart', 'ort-2026']);
  run('systemctl', ['--no-pager', '--full', 'status', 'ort-2026']);
} else {
  console.warn('Юнит ort-2026.service не найден. Поставь: sudo npm run setup:service');
}

const health = spawnSync('curl', ['-fsS', 'http://127.0.0.1:4000/api/health'], { encoding: 'utf8' });
if (health.status === 0) {
  console.log('API:', String(health.stdout).trim());
} else {
  console.warn('API пока не ответил. Смотри: journalctl -u ort-2026 -n 50 --no-pager');
}

const page = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1/'], { encoding: 'utf8' });
if (page.status === 0) console.log('Сайт HTTP', String(page.stdout).trim());

console.log('Готово. Обнови страницу в браузере (Ctrl+F5).');

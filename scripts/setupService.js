const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const UNIT_NAME = 'ort-2026.service';
const UNIT_PATH = `/etc/systemd/system/${UNIT_NAME}`;

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(err || `${cmd} ${args.join(' ')} failed`);
  }
  return String(result.stdout || '').trim();
}

function which(bin) {
  const result = spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout).trim() : '';
}

if (process.platform === 'win32') {
  console.error('systemd только на Linux-сервере. Локально Windows этот скрипт не нужен.');
  process.exit(1);
}

if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('Запусти от root: sudo npm run setup:service');
  process.exit(1);
}

const nodePath = fs.existsSync('/usr/bin/node') ? '/usr/bin/node' : which('node');
if (!nodePath) {
  console.error('Не найден node. Поставь Node.js 20+ и повтори.');
  process.exit(1);
}

const envFile = path.join(ROOT, '.env');
if (!fs.existsSync(envFile)) {
  console.error('Нет .env в корне проекта. Сначала: cp .env.example .env и заполни DATABASE_URL');
  process.exit(1);
}

const serverJs = path.join(ROOT, 'server', 'server.js');
const workDir = path.join(ROOT, 'server');
const unit = `[Unit]
Description=ORT 2026
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${workDir}
EnvironmentFile=${envFile}
Environment=NODE_ENV=production
ExecStart=${nodePath} ${serverJs}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
`;

fs.writeFileSync(UNIT_PATH, unit, 'utf8');
console.log(`Записан ${UNIT_PATH}`);

run('id', ['-u', 'www-data']);
run('chown', ['-R', 'www-data:www-data', ROOT]);
run('chmod', ['640', envFile]);
run('chmod', ['755', ROOT]);
run('systemctl', ['daemon-reload']);
run('systemctl', ['enable', '--now', 'ort-2026']);

console.log(run('systemctl', ['--no-pager', 'status', 'ort-2026']));
console.log('Сервис запущен. Проверка: curl http://127.0.0.1:4000/api/health');

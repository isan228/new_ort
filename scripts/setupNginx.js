const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AVAILABLE = '/etc/nginx/sites-available/ort-2026';
const ENABLED = '/etc/nginx/sites-enabled/ort-2026';
const DEFAULT_ENABLED = '/etc/nginx/sites-enabled/default';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(err || `${cmd} ${args.join(' ')} failed`);
  }
  return String(result.stdout || '').trim();
}

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

if (process.platform === 'win32') {
  console.error('nginx ставится только на Linux-сервере.');
  process.exit(1);
}

if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('Запусти от root: sudo npm run setup:nginx');
  process.exit(1);
}

if (!fs.existsSync('/etc/nginx/nginx.conf')) {
  console.error('nginx не установлен: apt-get install -y nginx');
  process.exit(1);
}

const env = readEnv(path.join(ROOT, '.env'));
let domain = process.env.DOMAIN || process.argv[2] || '';
if (!domain && env.CLIENT_URL) {
  try {
    domain = new URL(env.CLIENT_URL).hostname;
  } catch (_) {
    domain = '';
  }
}
if (!domain || domain === 'localhost' || domain === '127.0.0.1') {
  domain = 'ort.kg';
}

const names = domain === '_'
  ? '_'
  : [...new Set([domain, domain.startsWith('www.') ? domain.slice(4) : `www.${domain}`])].join(' ');

const conf = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${names};

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

function unlinkIfExists(file) {
  try {
    fs.unlinkSync(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

fs.writeFileSync(AVAILABLE, conf, 'utf8');
unlinkIfExists(DEFAULT_ENABLED);
unlinkIfExists('/etc/nginx/sites-enabled/default');
unlinkIfExists(ENABLED);
fs.symlinkSync(AVAILABLE, ENABLED);

run('nginx', ['-t']);
run('systemctl', ['reload', 'nginx']);

console.log(`nginx: ${AVAILABLE}`);
console.log(`server_name: ${names}`);
console.log('Стандартная заглушка Welcome to nginx отключена.');
console.log('Проверь: curl -I http://127.0.0.1/ и curl http://127.0.0.1/api/health');
if (domain !== '_') {
  const host = domain.replace(/^www\./, '');
  console.log(`HTTPS потом: certbot --nginx -d ${host} -d www.${host}`);
}

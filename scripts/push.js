const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REMOTE = 'https://github.com/isan228/new_ort.git';
const BRANCH = 'main';

function git(args, opts = {}) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.stdio || ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 && !opts.allowFail) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(err || `git ${args.join(' ')} failed`);
  }
  return result;
}

function hasRepo() {
  const result = git(['rev-parse', '--is-inside-work-tree'], { allowFail: true });
  return result.status === 0 && String(result.stdout).trim() === 'true';
}

function currentBranch() {
  const named = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
  if (named.status === 0 && String(named.stdout).trim() && String(named.stdout).trim() !== 'HEAD') {
    return String(named.stdout).trim();
  }
  return null;
}

function hasCommits() {
  const result = git(['rev-parse', '--verify', 'HEAD'], { allowFail: true });
  return result.status === 0;
}

function stagedFiles() {
  const result = git(['diff', '--cached', '--name-only'], { allowFail: true });
  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const extra = process.argv.slice(2).join(' ').trim();
  const message = extra || `update ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

  if (!hasRepo()) {
    git(['init']);
    console.log('git init');
  }

  const remotes = String(git(['remote'], { allowFail: true }).stdout || '');
  if (remotes.split(/\s+/).includes('origin')) {
    git(['remote', 'set-url', 'origin', REMOTE]);
  } else {
    git(['remote', 'add', 'origin', REMOTE]);
  }
  console.log(`origin → ${REMOTE}`);

  if (hasCommits()) {
    const branch = currentBranch();
    if (branch && branch !== BRANCH) {
      git(['branch', '-M', BRANCH]);
    }
  }

  git(['add', '-A']);
  const staged = stagedFiles();
  const secrets = staged.filter((file) => /(^|\/)\.env$/.test(file) || file.includes('credentials'));
  if (secrets.length) {
    git(['restore', '--staged', ...secrets], { allowFail: true });
    console.warn('Пропущены секреты (не пушим):', secrets.join(', '));
  }

  const pending = git(['status', '--porcelain']);
  const dirty = String(pending.stdout || '').trim();
  if (dirty) {
    const commit = git(['commit', '-m', message], { allowFail: true });
    if (commit.status !== 0) {
      console.error((commit.stderr || commit.stdout || '').trim());
      console.error('Коммит не создан. Проверь git user.name и user.email, затем снова: npm run push');
      process.exit(1);
    }
    console.log(`commit: ${message}`);
  } else {
    console.log('Нет новых файлов — пушим текущий коммит');
  }

  if (!hasCommits()) {
    console.error('Нечего пушить: рабочая папка пустая');
    process.exit(1);
  }

  if (currentBranch() !== BRANCH) {
    git(['branch', '-M', BRANCH]);
  }

  console.log(`git push -u origin ${BRANCH}`);
  const push = spawnSync('git', ['push', '-u', 'origin', BRANCH], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (push.status !== 0) {
    process.exit(push.status || 1);
  }
  console.log('Готово: https://github.com/isan228/new_ort');
}

main();

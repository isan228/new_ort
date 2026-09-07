function parseDatabaseUrl(raw) {
  const source = raw || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ort_2026';
  const url = new URL(source);
  const database = decodeURIComponent(url.pathname.replace(/^\//, '').split('/')[0] || 'ort_2026');
  return {
    url: source,
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    host: url.hostname || '127.0.0.1',
    port: Number(url.port || 5432),
    database,
  };
}

function assertSafeIdent(value, label) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Небезопасное имя ${label}: ${value}`);
  }
  return value;
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

module.exports = { parseDatabaseUrl, assertSafeIdent, quoteIdent, quoteLiteral };

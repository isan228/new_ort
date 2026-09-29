function normalizeLogin(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function assertLogin(value) {
  const login = normalizeLogin(value);
  if (login.length < 3) throw new Error('Логин слишком короткий — минимум 3 символа');
  if (login.length > 64) throw new Error('Логин слишком длинный');
  return login;
}

module.exports = { normalizeLogin, assertLogin };

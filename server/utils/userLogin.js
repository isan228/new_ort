function normalizeLogin(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

function assertLogin(value) {
  const login = normalizeLogin(value);
  if (login.length < 3 || login.length > 32) {
    throw new Error('Логин: 3–32 символа, латиница, цифры, точка, _ или -');
  }
  return login;
}

module.exports = { normalizeLogin, assertLogin };

// Cyrillic and other letters that look like Latin ones, so "test" and "tеst" (Cyrillic е) collide.
const LOOKALIKES = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c',
  т: 't', у: 'y', х: 'x', ь: 'b', і: 'i', ї: 'i', ј: 'j', ѕ: 's', һ: 'h', ү: 'y', ө: 'o',
  0: 'o', 1: 'l', '|': 'l',
};

function normalizeLogin(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

// Logins with the same key are treated as the same account name.
function loginKey(value) {
  return normalizeLogin(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._\-'"`]/g, '')
    .replace(/i/g, 'l')
    .split('')
    .map((ch) => (LOOKALIKES[ch] || ch).replace(/i/g, 'l'))
    .join('');
}

function assertLogin(value) {
  const login = normalizeLogin(value);
  if (!login) throw new Error('Придумайте логин');
  return login;
}

module.exports = { normalizeLogin, loginKey, assertLogin };

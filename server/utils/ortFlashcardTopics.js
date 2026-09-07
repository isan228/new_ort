const { normalizeTagName } = require('./ortTagNormalize');

function normalizeTopicTitle(raw) {
  return normalizeTagName(String(raw || '').replace(/=+/g, ''));
}

module.exports = { normalizeTopicTitle };

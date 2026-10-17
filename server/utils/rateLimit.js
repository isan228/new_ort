// In-memory sliding window. Counters live in this process only and reset on restart.
function createLimiter({ windowMs, max, maxKeys = 20000 }) {
  const hits = new Map();

  function recent(key, now = Date.now()) {
    const list = (hits.get(key) || []).filter((at) => now - at < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  }

  function sweep(now) {
    for (const key of hits.keys()) recent(key, now);
  }

  return {
    blocked(key) {
      return recent(key).length >= max;
    },
    hit(key) {
      const now = Date.now();
      const list = recent(key, now);
      list.push(now);
      hits.set(key, list);
      if (hits.size > maxKeys) sweep(now);
      return list.length;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

module.exports = { createLimiter, clientIp };

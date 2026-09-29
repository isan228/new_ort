// Express 4 does not forward rejected promises from async handlers to the error middleware;
// without this an exception in any async route crashes the whole process.
const Layer = require('express/lib/router/layer');

const original = Layer.prototype.handle_request;

Layer.prototype.handle_request = function handleRequest(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return original.call(this, req, res, next);
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === 'function') result.catch(next);
  } catch (err) {
    next(err);
  }
  return undefined;
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

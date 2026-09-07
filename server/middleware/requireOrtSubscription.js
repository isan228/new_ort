const { userHasOrtAccess } = require('../utils/adminUserAccess');

function requireOrtSubscription(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Нужна авторизация',
      code: 'ORT_AUTH_REQUIRED',
    });
  }
  if (!userHasOrtAccess(req.user)) {
    return res.status(403).json({
      error: 'Нужна подписка ОРТ',
      code: 'ORT_SUBSCRIPTION_REQUIRED',
    });
  }
  return next();
}

module.exports = { requireOrtSubscription };

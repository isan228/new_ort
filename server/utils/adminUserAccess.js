function userHasOrtAccess(user) {
  if (!user) return false;
  if (user.role === 'admin' || (user.isUgc && !user.ugcDisabled)) return true;
  if (!user.subscriptionEndDate) return false;
  return new Date(user.subscriptionEndDate) > new Date();
}

module.exports = { userHasOrtAccess };

const SEEN_KEY = 'ort_notif_seen';

function seenIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

export function markNotificationsSeen(ids) {
  const next = seenIds();
  ids.forEach((id) => next.add(id));
  localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
}

export function daysUntil(date) {
  if (!date) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function buildNotifications({ user, unreadChat = 0, t }) {
  const items = [];
  const end = user?.subscriptionEndDate;
  const days = daysUntil(end);

  if (end && days != null && days < 0) {
    items.push({
      id: `sub-expired-${new Date(end).toISOString().slice(0, 10)}`,
      kind: 'sub',
      title: t('notify.subExpiredTitle'),
      text: t('notify.subExpired'),
      href: '/app/premium',
      action: t('notify.renew'),
    });
  } else if (end && days === 0) {
    items.push({
      id: `sub-today-${new Date(end).toISOString().slice(0, 10)}`,
      kind: 'sub',
      title: t('notify.subTodayTitle'),
      text: t('notify.subToday'),
      href: '/app/premium',
      action: t('notify.renew'),
    });
  } else if (end && days >= 1 && days <= 3) {
    items.push({
      id: `sub-days-${days}-${new Date(end).toISOString().slice(0, 10)}`,
      kind: 'sub',
      title: t('notify.subSoonTitle'),
      text: t('notify.subSoon', { n: days }),
      href: '/app/premium',
      action: t('notify.renew'),
    });
  }

  if (unreadChat > 0) {
    items.push({
      id: 'chat-unread',
      kind: 'chat',
      title: t('notify.chatTitle'),
      text: unreadChat === 1 ? t('notify.chat') : t('notify.chatMany', { n: unreadChat }),
      action: t('notify.openChat'),
      open: 'chat',
    });
  }

  const seen = seenIds();
  return items.map((item) => ({ ...item, unseen: !seen.has(item.id) }));
}

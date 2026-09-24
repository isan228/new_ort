import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { chatApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { buildNotifications, markNotificationsSeen } from '../lib/notifications';
import { StudentChat } from './StudentChat';

const HIDDEN = ['/app/test', '/app/exam', '/app/support', '/app/create'];

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.4L4 21.4V6a2 2 0 0 1 2-2Zm2 3.5v7.2l1.8-1.2H18V7.5H6Z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 22a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 22Zm8-6v-5.2A8 8 0 0 0 13.2 3V2a1.2 1.2 0 1 0-2.4 0v1A8 8 0 0 0 4 10.8V16l-1.8 1.8V19h19.6v-1.2L20 16Z"
      />
    </svg>
  );
}

function DockBadge({ count }) {
  if (!count) return null;
  return <span className="dock-badge">{count > 99 ? '99+' : count}</span>;
}

export function CabinetDock() {
  const { user } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const [open, setOpen] = useState(null);
  const [unread, setUnread] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const data = await chatApi.unread();
        if (!stop) setUnread(data.unread || 0);
      } catch {
        if (!stop) setUnread(0);
      }
    }
    load();
    const id = setInterval(load, 10000);
    return () => { stop = true; clearInterval(id); };
  }, [open]);

  useEffect(() => { setOpen(null); }, [location.pathname]);

  const notifications = useMemo(
    () => buildNotifications({ user, unreadChat: unread, t }),
    [t, tick, unread, user],
  );
  const unseen = notifications.filter((item) => item.unseen).length;

  function close() {
    if (open === 'bell') {
      markNotificationsSeen(notifications.filter((item) => item.kind !== 'chat').map((item) => item.id));
      setTick((n) => n + 1);
    }
    setOpen(null);
  }

  function toggle(next) {
    if (open === next) {
      close();
      return;
    }
    if (open === 'bell') {
      markNotificationsSeen(notifications.filter((item) => item.kind !== 'chat').map((item) => item.id));
      setTick((n) => n + 1);
    }
    if (next === 'chat') {
      markNotificationsSeen(['chat-unread']);
      setUnread(0);
      setTick((n) => n + 1);
    }
    setOpen(next);
  }

  if (!user || HIDDEN.some((path) => location.pathname.startsWith(path))) return null;

  return (
    <div className="cabinet-dock">
      {open && <button type="button" className="dock-scrim" aria-label={t('common.closeMenu')} onClick={close} />}
      {open === 'chat' && (
        <div className="dock-panel">
          <div className="dock-panel-head">
            <div>
              <b>{t('chat.title')}</b>
              <p className="muted" style={{ margin: 0 }}>{t('chat.lead')}</p>
            </div>
            <button type="button" className="dock-close" onClick={close} aria-label={t('common.closeMenu')}>×</button>
          </div>
          <StudentChat />
        </div>
      )}
      {open === 'bell' && (
        <div className="dock-panel dock-notify">
          <div className="dock-panel-head">
            <b>{t('notify.title')}</b>
            <button type="button" className="dock-close" onClick={close} aria-label={t('common.closeMenu')}>×</button>
          </div>
          <div className="dock-notify-list">
            {!notifications.length && <p className="empty">{t('notify.empty')}</p>}
            {notifications.map((item) => (
              <article key={item.id} className={`dock-note ${item.unseen ? 'unseen' : ''}`}>
                <b>{item.title}</b>
                <p>{item.text}</p>
                {item.open === 'chat' ? (
                  <button type="button" className="btn sm" onClick={() => toggle('chat')}>{item.action}</button>
                ) : (
                  <Link className="btn sm" to={item.href} onClick={close}>{item.action}</Link>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      <div className="dock-btns">
        <button
          type="button"
          className={`dock-btn bell${open === 'bell' ? ' on' : ''}`}
          aria-label={t('notify.title')}
          onClick={() => toggle('bell')}
        >
          <BellIcon />
          <DockBadge count={unseen} />
        </button>
        <button
          type="button"
          className={`dock-btn chat${open === 'chat' ? ' on' : ''}`}
          aria-label={t('chat.title')}
          onClick={() => toggle('chat')}
        >
          <ChatIcon />
          <DockBadge count={open === 'chat' ? 0 : unread} />
        </button>
      </div>
    </div>
  );
}

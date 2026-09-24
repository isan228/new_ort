import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { ChatComposer, ChatThread } from '../../components/ChatThread';
import { useLang } from '../../context/LangContext';

export default function AdminChat() {
  const { t, locale } = useLang();
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get('user')) || null;
  const [threads, setThreads] = useState([]);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadThreads = useCallback(async () => {
    const data = await adminApi.chatThreads();
    setThreads(data.threads || []);
  }, []);

  const loadThread = useCallback(async (userId) => {
    if (!userId) {
      setUser(null);
      setMessages([]);
      return;
    }
    const data = await adminApi.chatThread(userId);
    setUser(data.user);
    setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        if (stop) return;
        await loadThreads();
        if (selectedId) await loadThread(selectedId);
      } catch (err) {
        if (!stop) setError(err.message);
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(id); };
  }, [loadThread, loadThreads, selectedId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((row) => {
      const u = row.user || {};
      return [u.name, u.login, u.email, row.lastText].some((v) => String(v || '').toLowerCase().includes(needle));
    });
  }, [q, threads]);

  function openThread(userId) {
    setParams({ user: String(userId) });
    setError('');
    setText('');
  }

  async function send() {
    if (!selectedId || busy) return;
    const next = text.trim();
    if (!next) return;
    setBusy(true);
    setError('');
    try {
      const data = await adminApi.chatReply(selectedId, next);
      setText('');
      setMessages((prev) => [...prev, data.message]);
      await loadThreads();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`chat-page admin${selectedId ? ' has-thread' : ''}`}>
      <aside className="chat-inbox">
        <div className="admin-section-head" style={{ marginTop: 0 }}>
          <div>
            <h1>{t('chat.threads')}</h1>
            <p className="muted">{threads.length}</p>
          </div>
        </div>
        <input
          className="admin-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.userSearch')}
        />
        <div className="chat-thread-list">
          {!visible.length && <p className="empty">{t('chat.noThreads')}</p>}
          {visible.map((row) => {
            const active = selectedId === row.userId;
            return (
              <button
                key={row.userId}
                type="button"
                className={`chat-thread-item${active ? ' on' : ''}`}
                onClick={() => openThread(row.userId)}
              >
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <b>{row.user?.name || t('chat.student')}</b>
                  {row.unread > 0 && <span className="nav-unread">{row.unread}</span>}
                </div>
                <span className="muted chat-preview">{row.lastText}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="chat-box">
        {selectedId ? (
          <>
            <div className="chat-box-head">
              <button type="button" className="btn ghost sm chat-back" onClick={() => setParams({})}>
                {t('common.cancel')}
              </button>
              <div>
                <b>{user?.name || t('chat.student')}</b>
                <p className="muted" style={{ margin: 0 }}>{user?.login || user?.email || ''}</p>
              </div>
            </div>
            {error && <p className="err" style={{ margin: '0 16px' }}>{error}</p>}
            <ChatThread messages={messages} t={t} locale={locale} empty={t('chat.emptyAdmin')} viewer="admin" />
            <ChatComposer value={text} onChange={setText} onSend={send} busy={busy} t={t} />
          </>
        ) : (
          <p className="empty chat-pick">{t('chat.pick')}</p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';

function formatWhen(value, locale) {
  if (!value) return '';
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ChatThread({ messages, t, locale, empty, viewer = 'student' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-thread" ref={ref}>
      {!messages.length && <p className="empty">{empty}</p>}
      {messages.map((m) => {
        const mine = viewer === 'admin' ? m.fromAdmin : !m.fromAdmin;
        const label = m.fromAdmin
          ? (viewer === 'admin' ? t('chat.you') : t('chat.admin'))
          : (viewer === 'admin' ? t('chat.student') : t('chat.you'));
        return (
          <div key={m.id} className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
            <div className="chat-meta">{label} · {formatWhen(m.createdAt, locale)}</div>
            <div className="chat-text">{m.text}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ChatComposer({ value, onChange, onSend, busy, t }) {
  function submit(e) {
    e.preventDefault();
    onSend();
  }

  return (
    <form className="chat-composer" onSubmit={submit}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('chat.placeholder')}
        rows={2}
        maxLength={2000}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button className="btn" type="submit" disabled={busy || !String(value).trim()}>{t('chat.send')}</button>
    </form>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { chatApi } from '../api/client';
import { ChatComposer, ChatThread } from '../components/ChatThread';
import { useLang } from '../context/LangContext';

export default function Support() {
  const { t, locale } = useLang();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await chatApi.messages();
    setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        if (!stop) await load();
      } catch (err) {
        if (!stop) setError(err.message);
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(id); };
  }, [load]);

  async function send() {
    const next = text.trim();
    if (!next || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await chatApi.send(next);
      setText('');
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-page">
      <div>
        <h1>{t('chat.title')}</h1>
        <p className="muted">{t('chat.lead')}</p>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="chat-box">
        <ChatThread messages={messages} t={t} locale={locale} empty={t('chat.empty')} viewer="student" />
        <ChatComposer value={text} onChange={setText} onSend={send} busy={busy} t={t} />
      </div>
    </div>
  );
}

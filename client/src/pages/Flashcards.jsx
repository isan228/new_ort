import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { buildFrontHtml } from '../lib/linkify';

const PROG_KEY = 'ortFlashcardProgress';

function loadCardProgress() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY) || '{}'); } catch { return {}; }
}
function saveCardProgress(data) { localStorage.setItem(PROG_KEY, JSON.stringify(data)); }

export default function Flashcards() {
  const { bank } = useBank();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [tab, setTab] = useState('all');
  const [session, setSession] = useState(null);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(loadCardProgress);

  useEffect(() => {
    const params = {};
    if (bank?.testId) params.testId = bank.testId;
    if (bank?.trackGroup) params.trackGroup = bank.trackGroup;
    ortApi.flashcards(params)
      .then((d) => setCards(d.flashcards || []))
      .catch((err) => { if (isOrtGate(err)) navigate('/app/premium'); });
  }, [bank, navigate]);

  const buckets = useMemo(() => {
    const b = { new: [], review: [], hard: [], learned: [], fav: [] };
    for (const card of cards) {
      const p = progress[card.id];
      if (!p) b.new.push(card);
      else if (p.status === 'again' || p.status === 'hard') b.hard.push(card);
      else if (p.status === 'easy') b.learned.push(card);
      else b.review.push(card);
      if (p?.fav) b.fav.push(card);
    }
    return b;
  }, [cards, progress]);

  const due = buckets.new.length + buckets.review.length + buckets.hard.length;
  const list = tab === 'all' ? cards : buckets[tab] || cards;

  function rate(status) {
    const card = session[idx];
    const next = { ...progress, [card.id]: { status, lastUsed: Date.now() } };
    setProgress(next);
    saveCardProgress(next);
    setShow(false);
    if (idx + 1 < session.length) setIdx(idx + 1);
    else setSession(null);
  }

  if (session?.[idx]) {
    const card = session[idx];
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <p className="muted">{idx + 1} / {session.length} · интервальное повторение</p>
        <div className="flip">
          <div className={`flip-inner ${show ? 'show' : ''}`}>
            <div className="flip-face" dangerouslySetInnerHTML={{ __html: buildFrontHtml(card.frontText) }} />
            <div className="flip-face back">{card.backText}</div>
          </div>
        </div>
        {!show ? (
          <button className="btn lg" style={{ width: '100%', marginTop: 16 }} type="button" onClick={() => setShow(true)}>Показать ответ</button>
        ) : (
          <div className="rate-grid" style={{ marginTop: 16 }}>
            <button className="btn bad" type="button" onClick={() => rate('again')}>Снова</button>
            <button className="btn warn" type="button" onClick={() => rate('hard')}>Сложно</button>
            <button className="btn ghost" type="button" onClick={() => rate('good')}>Хорошо</button>
            <button className="btn ok" type="button" onClick={() => rate('easy')}>Легко</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>Флеш-карты</h1>
      <p className="muted">Сегодня: {due} карточек. Система сама решает, что повторить — как Anki.</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Повторение сегодня</h3>
        <b style={{ fontSize: 28 }}>{due} карточек требуют повторения</b>
        <p className="muted">Новые → Изучение → Повторение → Выучено</p>
        <div className="progress"><i style={{ width: `${cards.length ? Math.round((buckets.learned.length / cards.length) * 100) : 0}%` }} /></div>
      </div>
      <div className="tabs">
        {[
          ['all', 'Все'],
          ['new', 'Новые'],
          ['review', 'На повторение'],
          ['hard', 'Сложные'],
          ['learned', 'Выученные'],
          ['fav', 'Избранные'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label} ({id === 'all' ? cards.length : (buckets[id] || []).length})</button>
        ))}
      </div>
      {!cards.length && <div className="empty">Пока нет карточек. Загрузи их в админке или выбери банк.</div>}
      <div className="cards">
        {list.map((card) => (
          <div key={card.id} className="card">
            <div dangerouslySetInnerHTML={{ __html: buildFrontHtml(card.frontText) }} />
            <p className="muted">{(card.tags || []).map((t) => t.name).join(', ')}</p>
          </div>
        ))}
      </div>
      {!!list.length && (
        <button className="btn lg" style={{ marginTop: 16 }} type="button" onClick={() => { setSession(list); setIdx(0); setShow(false); }}>
          Повторить карточки
        </button>
      )}
      {!bank && <p className="muted" style={{ marginTop: 12 }}>Банк не выбран — показаны все карточки. <Link to="/app/tests">Выбрать тест</Link></p>}
    </div>
  );
}

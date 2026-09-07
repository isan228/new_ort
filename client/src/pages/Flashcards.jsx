import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { buildFrontHtml } from '../lib/linkify';

const PROG_KEY = 'ortFlashcardProgress';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROG_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress(data) {
  localStorage.setItem(PROG_KEY, JSON.stringify(data));
}

export default function Flashcards() {
  const { bank } = useBank();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [mode, setMode] = useState('browse');
  const [topicId, setTopicId] = useState(null);
  const [session, setSession] = useState([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [progress, setProgress] = useState(loadProgress);

  useEffect(() => {
    const params = {};
    if (bank?.testId) params.testId = bank.testId;
    if (bank?.trackGroup) params.trackGroup = bank.trackGroup;
    ortApi.flashcards(params)
      .then((d) => setCards(d.flashcards || []))
      .catch((err) => {
        if (isOrtGate(err)) navigate('/subscriptions');
      });
  }, [bank, navigate]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const card of cards) {
      const tag = (card.tags && card.tags[0]) || { id: 0, name: 'Без темы' };
      if (!map.has(tag.id)) map.set(tag.id, { tag, cards: [] });
      map.get(tag.id).cards.push(card);
    }
    return [...map.values()];
  }, [cards]);

  const visible = topicId == null ? cards : cards.filter((c) => (c.tags || []).some((t) => t.id === topicId));

  function rate(status) {
    const card = session[idx];
    const next = {
      ...progress,
      [card.id]: { status, lastUsed: Date.now() },
    };
    setProgress(next);
    saveProgress(next);
    setShowBack(false);
    if (idx + 1 < session.length) setIdx(idx + 1);
    else setMode('study');
  }

  function startSession(list) {
    setSession(list);
    setIdx(0);
    setShowBack(false);
    setMode('session');
  }

  const studyRows = groups.map((g) => {
    const stats = { new: 0, learning: 0, review: 0, last: 0 };
    for (const card of g.cards) {
      const p = progress[card.id];
      if (!p) stats.new += 1;
      else if (p.status === 'again') stats.learning += 1;
      else stats.review += 1;
      if (p?.lastUsed) stats.last = Math.max(stats.last, p.lastUsed);
    }
    return { ...g, stats };
  });

  return (
    <div>
      <h1 className="serif">Карточки</h1>
      {!bank && <p className="muted">Банк не выбран — показаны все доступные карточки. <Link to="/ort">Выбрать банк</Link></p>}
      <div className="tabs">
        <button type="button" className={mode === 'browse' ? 'on' : ''} onClick={() => setMode('browse')}>Обзор</button>
        <button type="button" className={mode === 'study' || mode === 'session' ? 'on' : ''} onClick={() => setMode('study')}>Учёба</button>
      </div>

      {mode === 'browse' && (
        <>
          <div className="tag-wrap" style={{ marginBottom: 16 }}>
            <button type="button" className={`chip ${topicId == null ? 'on' : ''}`} onClick={() => setTopicId(null)}>Все</button>
            {groups.map((g) => (
              <button key={g.tag.id} type="button" className={`chip ${topicId === g.tag.id ? 'on' : ''}`} onClick={() => setTopicId(g.tag.id)}>
                {g.tag.name} ({g.cards.length})
              </button>
            ))}
          </div>
          <div className="bank-list">
            {visible.map((card) => (
              <div key={card.id} className="card">
                <div dangerouslySetInnerHTML={{ __html: buildFrontHtml(card.frontText) }} />
                <p className="muted" style={{ marginTop: 8 }}>{(card.tags || []).map((t) => t.name).join(', ')}</p>
              </div>
            ))}
          </div>
          {!!visible.length && <button className="btn" style={{ marginTop: 16 }} type="button" onClick={() => startSession(visible)}>Учить эти карточки</button>}
        </>
      )}

      {mode === 'study' && (
        <table className="table">
          <thead>
            <tr>
              <th>Колода</th>
              <th>Новые</th>
              <th>Учу</th>
              <th>Повтор</th>
              <th>Последний раз</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {studyRows.map((row) => (
              <tr key={row.tag.id}>
                <td>{row.tag.name}</td>
                <td>{row.stats.new}</td>
                <td>{row.stats.learning}</td>
                <td>{row.stats.review}</td>
                <td>{row.stats.last ? new Date(row.stats.last).toLocaleDateString('ru-KG') : '—'}</td>
                <td><button className="btn" type="button" onClick={() => startSession(row.cards)}>Play</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {mode === 'session' && session[idx] && (
        <div className="card">
          <p className="muted">{idx + 1} / {session.length}</p>
          {!showBack ? (
            <div className="q-text" dangerouslySetInnerHTML={{ __html: buildFrontHtml(session[idx].frontText) }} />
          ) : (
            <div className="q-text">{session[idx].backText}</div>
          )}
          {!showBack ? (
            <button className="btn" type="button" onClick={() => setShowBack(true)}>Показать ответ</button>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn danger" type="button" onClick={() => rate('again')}>Again</button>
              <button className="btn ghost" type="button" onClick={() => rate('good')}>Good</button>
              <button className="btn gold" type="button" onClick={() => rate('easy')}>Easy</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

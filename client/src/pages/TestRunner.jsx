import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { useBank } from '../context/BankContext';
import { bumpToday, loadProgress, saveProgress, toggleFavorite } from '../lib/progress';

export default function TestRunner() {
  const { bank } = useBank();
  const navigate = useNavigate();
  const session = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('ortSession') || 'null'); } catch { return null; }
  }, []);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const [flagged, setFlagged] = useState({});
  const [left, setLeft] = useState(() => Math.round((session?.minutes || 20) * 60));
  const examMode = !!session?.examMode;

  useEffect(() => {
    if (!session?.questions) return undefined;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [session]);

  useEffect(() => {
    if (left === 0 && session?.questions) finish();
  }, [left]);

  if (!session?.questions?.length) {
    return <p>Сессия пуста. <Link to="/app/tests">Соберите тест</Link>.</p>;
  }

  const questions = session.questions;
  const q = questions[index];
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  async function finish() {
    const answers = questions.map((item) => ({
      questionId: item.id,
      answerId: picked[item.id] || null,
    }));
    const data = await ortApi.check(session.test.id, {
      answers,
      questionMode: session.questionMode,
      durationSec: Math.round((Date.now() - session.startedAt) / 1000),
    });
    bumpToday(answers.filter((a) => a.answerId).length);
    sessionStorage.setItem('ortResult', JSON.stringify({ ...data, examMode, bank: bank?.name }));
    const p = loadProgress();
    p.lastResultId = data.resultId;
    saveProgress(p);
    navigate('/app/results');
  }

  function skip() {
    const p = loadProgress();
    p.skipped = [...new Set([...(p.skipped || []), q.id])];
    saveProgress(p);
    if (index < questions.length - 1) setIndex(index + 1);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="muted">{bank?.name || session.test?.name}</div>
          <b>Вопрос {index + 1} / {questions.length}</b>
        </div>
        <span className="badge brand">Осталось {mm}:{ss}</span>
      </div>
      <div className="progress" style={{ margin: '12px 0 20px' }}>
        <i style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <p className="q-text">{q.text}</p>
      <div style={{ display: 'grid', gap: 10, margin: '18px 0' }}>
        {q.answers.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`answer ${picked[q.id] === a.id ? 'on' : ''}`}
            onClick={() => setPicked((prev) => ({ ...prev, [q.id]: a.id }))}
          >
            {a.text}
          </button>
        ))}
      </div>
      {!examMode && picked[q.id] && <p className="muted">Ответ записан. В тренировке разбор откроется после сдачи — без спойлера в условии.</p>}
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn ghost" type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Назад</button>
        <button className="btn ghost" type="button" onClick={skip}>Пропустить</button>
        <button className="btn purple" type="button" onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))}>
          {flagged[q.id] ? 'Снять отметку' : 'Отметить'}
        </button>
        <button className="btn ghost" type="button" onClick={() => toggleFavorite(q.id)}>В избранное</button>
        {index < questions.length - 1
          ? <button className="btn" type="button" onClick={() => setIndex(index + 1)}>Следующий вопрос</button>
          : <button className="btn" type="button" onClick={finish}>Завершить тест</button>}
      </div>
      <div className="q-nav">
        {questions.map((item, i) => {
          let cls = 'q-dot';
          if (i === index) cls += ' on';
          else if (picked[item.id]) cls += ' done';
          if (flagged[item.id]) cls += ' flag';
          return (
            <button key={item.id} type="button" className={cls} onClick={() => setIndex(i)}>{i + 1}</button>
          );
        })}
      </div>
    </div>
  );
}

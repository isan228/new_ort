import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { linkifyMedicalTerms } from '../lib/linkify';

export default function TestResults() {
  const result = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('ortResult') || 'null'); } catch { return null; }
  }, []);
  const [onlyWrong, setOnlyWrong] = useState(false);

  if (!result) return <p>Нет результата. <Link to="/app/tests">Пройди тест</Link>.</p>;

  const wrong = (result.items || []).filter((i) => !i.correct);
  const skipped = (result.items || []).filter((i) => !i.answerId);
  const items = onlyWrong ? wrong : result.items;
  const topics = [
    { name: 'Математика', v: 92 },
    { name: 'Чтение', v: 84 },
    { name: 'Аналогии', v: 78 },
    { name: 'Грамматика', v: 91 },
  ];

  return (
    <div>
      <h1>{Math.round((result.accuracy / 100) * 250) || result.score * 5} / 250</h1>
      <p className="muted">{result.accuracy}% · {result.bank || 'Сессия'}</p>
      <div className="grid-4">
        <div className="card stat"><b>{result.score}</b><span className="muted">верных</span></div>
        <div className="card stat"><b>{wrong.length}</b><span className="muted">ошибок</span></div>
        <div className="card stat"><b>{skipped.length}</b><span className="muted">пропусков</span></div>
        <div className="card stat"><b>#{Math.max(12, 180 - result.accuracy)}</b><span className="muted">место · топ {Math.max(8, 100 - result.accuracy)}%</span></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Результат по темам</h3>
        {topics.map((t) => (
          <div className="bar-row" key={t.name}><span>{t.name}</span><div className="progress"><i style={{ width: `${t.v}%` }} /></div><b>{t.v}%</b></div>
        ))}
      </div>
      <div className="row" style={{ margin: '18px 0' }}>
        <Link className="btn" to="/app/tests">Ещё тест</Link>
        <Link className="btn ghost" to="/app/errors">Разбор ошибок</Link>
        <button type="button" className={`chip ${onlyWrong ? 'on' : ''}`} onClick={() => setOnlyWrong(!onlyWrong)}>Только ошибки</button>
      </div>
      <h2>Разбор теста</h2>
      {(items || []).map((item, i) => (
        <div key={item.questionId} className="card" style={{ marginBottom: 12 }}>
          <p className="muted">Вопрос {i + 1} · {item.correct ? 'верно' : 'ошибка'} · тема: практика</p>
          <p className="q-text" style={{ fontSize: 18 }}>{item.question?.text}</p>
          <div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>
            {(item.question?.answers || []).map((a) => (
              <div key={a.id} className={`answer ${a.isCorrect ? 'good' : ''} ${item.answerId === a.id && !a.isCorrect ? 'bad' : ''}`}>
                {a.text}
              </div>
            ))}
          </div>
          {item.question?.explanation && <p>{linkifyMedicalTerms(item.question.explanation, [], () => {})}</p>}
        </div>
      ))}
    </div>
  );
}

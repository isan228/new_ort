import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { linkifyMedicalTerms } from '../lib/linkify';
import { useLang } from '../context/LangContext';

export default function TestResults() {
  const { t } = useLang();
  const result = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('ortResult') || 'null'); } catch { return null; }
  }, []);
  const [onlyWrong, setOnlyWrong] = useState(false);

  if (!result) return <p>{t('results.none')} <Link to="/app/tests">{t('results.go')}</Link>.</p>;

  const wrong = (result.items || []).filter((i) => !i.correct);
  const skipped = (result.items || []).filter((i) => !i.answerId);
  const items = onlyWrong ? wrong : result.items;
  const topics = [
    { name: t('results.math'), v: 92 },
    { name: t('results.reading'), v: 84 },
    { name: t('results.analogies'), v: 78 },
    { name: t('results.grammar'), v: 91 },
  ];

  return (
    <div>
      <h1>{Math.round((result.accuracy / 100) * 250) || result.score * 5} / 250</h1>
      <p className="muted">{result.accuracy}% · {result.bank || t('results.session')}</p>
      <div className="grid-4">
        <div className="card stat"><b>{result.score}</b><span className="muted">{t('results.correct')}</span></div>
        <div className="card stat"><b>{wrong.length}</b><span className="muted">{t('results.wrong')}</span></div>
        <div className="card stat"><b>{skipped.length}</b><span className="muted">{t('results.skip')}</span></div>
        <div className="card stat"><b>#{Math.max(12, 180 - result.accuracy)}</b><span className="muted">{t('results.place', { n: Math.max(8, 100 - result.accuracy) })}</span></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('results.byTopic')}</h3>
        {topics.map((topic) => (
          <div className="bar-row" key={topic.name}><span>{topic.name}</span><div className="progress"><i style={{ width: `${topic.v}%` }} /></div><b>{topic.v}%</b></div>
        ))}
      </div>
      <div className="row" style={{ margin: '18px 0' }}>
        <Link className="btn" to="/app/tests">{t('results.more')}</Link>
        <Link className="btn ghost" to="/app/errors">{t('results.review')}</Link>
        <button type="button" className={`chip ${onlyWrong ? 'on' : ''}`} onClick={() => setOnlyWrong(!onlyWrong)}>{t('results.onlyWrong')}</button>
      </div>
      <h2>{t('results.breakdown')}</h2>
      {(items || []).map((item, i) => (
        <div key={item.questionId} className="card" style={{ marginBottom: 12 }}>
          <p className="muted">{t('results.qn', { n: i + 1 })} · {item.correct ? t('results.ok') : t('results.bad')} · {t('results.topic')}</p>
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

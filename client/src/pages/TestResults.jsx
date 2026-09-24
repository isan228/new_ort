import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { linkifyMedicalTerms } from '../lib/linkify';
import { useLang } from '../context/LangContext';

function formatOrt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(value).replace('.', ',');
}

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
  const breakdown = result.breakdown || [];
  const official = result.officialScore != null ? result.officialScore : result.score;
  const maxScore = result.maxScore;

  return (
    <div>
      <h1>
        {formatOrt(official)}
        {maxScore ? ` / ${maxScore}` : ''}
      </h1>
      <p className="muted">
        {result.accuracy}% · {result.bank || t('results.session')}
        {maxScore ? ` · ${t('results.official')}` : ''}
      </p>
      <div className="grid-4">
        <div className="card stat"><b>{result.score}</b><span className="muted">{t('results.correct')}</span></div>
        <div className="card stat"><b>{wrong.length}</b><span className="muted">{t('results.wrong')}</span></div>
        <div className="card stat"><b>{skipped.length}</b><span className="muted">{t('results.skip')}</span></div>
        <div className="card stat"><b>{formatOrt(official)}</b><span className="muted">{t('results.points')}</span></div>
      </div>
      {!!breakdown.length && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{t('results.official')}</h3>
          <div className="ort-score-rows">
            {breakdown.map((row) => (
              <div className="ort-score-row" key={row.key}>
                <span>{row.title}</span>
                <b>{t('results.factor', {
                  n: row.correct,
                  factor: formatOrt(row.factor),
                  points: formatOrt(row.points),
                })}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ margin: '18px 0' }}>
        <Link className="btn" to="/app/tests">{t('results.more')}</Link>
        <Link className="btn ghost" to="/app/errors">{t('results.review')}</Link>
        <button type="button" className={`chip ${onlyWrong ? 'on' : ''}`} onClick={() => setOnlyWrong(!onlyWrong)}>{t('results.onlyWrong')}</button>
      </div>
      <h2>{t('results.breakdown')}</h2>
      {(items || []).map((item, i) => (
        <div key={item.questionId} className="card" style={{ marginBottom: 12 }}>
          <p className="muted">{t('results.qn', { n: i + 1 })} · {item.correct ? t('results.ok') : t('results.bad')}</p>
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

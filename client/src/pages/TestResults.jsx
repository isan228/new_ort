import { useMemo } from 'react';
import { Link } from 'react-router-dom';
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

  if (!result) return <p>{t('results.none')} <Link to="/app/tests">{t('results.go')}</Link>.</p>;

  const wrong = (result.items || []).filter((i) => !i.correct);
  const skipped = (result.items || []).filter((i) => !i.answerId);
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
      <div className="row" style={{ margin: '18px 0', flexWrap: 'wrap' }}>
        <Link className="btn lg" to="/app/review">{t('results.openReview')}</Link>
        {!!wrong.length && <Link className="btn" to="/app/review?wrong=1">{t('results.review')}</Link>}
        <Link className="btn ghost" to="/app/tests">{t('results.more')}</Link>
      </div>
    </div>
  );
}

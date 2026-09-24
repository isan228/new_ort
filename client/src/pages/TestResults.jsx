import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { linkifyMedicalTerms } from '../lib/linkify';
import { useLang } from '../context/LangContext';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
  const [index, setIndex] = useState(0);

  if (!result) return <p>{t('results.none')} <Link to="/app/tests">{t('results.go')}</Link>.</p>;

  const wrong = (result.items || []).filter((i) => !i.correct);
  const skipped = (result.items || []).filter((i) => !i.answerId);
  const items = onlyWrong ? wrong : (result.items || []);
  const breakdown = result.breakdown || [];
  const official = result.officialScore != null ? result.officialScore : result.score;
  const maxScore = result.maxScore;
  const item = items[Math.min(index, Math.max(0, items.length - 1))];
  const answers = item?.question?.answers || [];

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
        <button type="button" className={`chip ${onlyWrong ? 'on' : ''}`} onClick={() => { setOnlyWrong(!onlyWrong); setIndex(0); }}>
          {t('results.onlyWrong')}
        </button>
      </div>

      <h2>{t('results.breakdown')}</h2>
      {!items.length && <p className="empty">—</p>}
      {!!items.length && item && (
        <div className="card review-lab" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="exam-top">
            <div className="exam-meta">
              <b>{t('runner.item', { a: index + 1, b: items.length })}</b>
              <span>{t('runner.qid', { id: item.questionId })}</span>
              <span>{item.correct ? t('results.ok') : t('results.bad')}</span>
            </div>
            <div className="exam-nav">
              <button type="button" className="exam-nav-btn" disabled={index <= 0} onClick={() => setIndex((n) => n - 1)}>
                ‹ {t('runner.prev')}
              </button>
              <button type="button" className="exam-nav-btn" disabled={index >= items.length - 1} onClick={() => setIndex((n) => n + 1)}>
                {t('runner.next')} ›
              </button>
            </div>
          </div>
          <div className="exam-body">
            <aside className="exam-side">
              {items.map((row, i) => (
                <button
                  key={row.questionId}
                  type="button"
                  className={`exam-num ${i === index ? 'on' : ''} ${row.correct ? 'done' : 'flag'}`}
                  onClick={() => setIndex(i)}
                >
                  <em>{i + 1}</em>
                  <i className={`exam-dot ${row.answerId ? '' : 'empty'}`} />
                </button>
              ))}
            </aside>
            <main className="exam-main">
              <div className="exam-content">
                <p className="exam-stem">{item.question?.text}</p>
                <div className="exam-opts">
                  {answers.map((a, i) => {
                    let cls = 'exam-opt';
                    if (a.isCorrect) cls += ' good';
                    else if (item.answerId === a.id) cls += ' bad';
                    if (item.answerId === a.id) cls += ' on';
                    return (
                      <div key={a.id} className={cls}>
                        <i className="exam-radio" />
                        <span><b>({LETTERS[i]})</b> {a.text}</span>
                      </div>
                    );
                  })}
                </div>
                {item.question?.explanation && (
                  <p style={{ marginTop: 16 }}>{linkifyMedicalTerms(item.question.explanation, [], () => {})}</p>
                )}
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

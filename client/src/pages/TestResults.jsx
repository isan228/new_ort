import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { linkifyMedicalTerms } from '../lib/linkify';
import { useLang } from '../context/LangContext';
import '../styles/exam-uworld.css';

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
        <div className="card review-lab" style={{ padding: 0 }}>
          <header className="uworld-session-topbar">
            <div className="uworld-tb-left">
              <div className="uworld-tb-item-info">
                <span className="uworld-tb-item-label">{t('runner.item', { a: index + 1, b: items.length })}</span>
                <span className="uworld-tb-qid">{item.correct ? t('results.ok') : t('results.bad')}</span>
              </div>
            </div>
            <div className="uworld-tb-nav">
              <button type="button" className="uworld-tb-nav-btn" disabled={index <= 0} onClick={() => setIndex((n) => n - 1)}>
                <span>{t('runner.prev')}</span>
              </button>
              <button type="button" className="uworld-tb-nav-btn" disabled={index >= items.length - 1} onClick={() => setIndex((n) => n + 1)}>
                <span>{t('runner.next')}</span>
              </button>
            </div>
          </header>
          <div className="test-session-layout has-usmle-qnav">
            <aside className="usmle-qnav">
              <ol className="usmle-qnav-list">
                {items.map((row, i) => (
                  <li key={row.questionId} className={`usmle-qnav-item ${i === index ? 'is-active' : ''} ${row.correct ? 'is-answered' : 'is-favorite'}`}>
                    <button type="button" className="usmle-qnav-btn" onClick={() => setIndex(i)}>
                      <i className="usmle-qnav-dot" />
                      <span className="usmle-qnav-num">{i + 1}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </aside>
            <div className="test-session-main">
              <div className="test-content">
                <p className="usmle-question-stem">{item.question?.text}</p>
                <div className="answers-list">
                  {answers.map((a, i) => {
                    let cls = 'answer-item';
                    if (a.isCorrect) cls += ' correct selected';
                    else if (item.answerId === a.id) cls += ' incorrect selected';
                    return (
                      <div key={a.id} className={cls}>
                        <span className="answer-option-letter">{LETTERS[i]}</span>
                        <span className="answer-option-text">{a.text}</span>
                      </div>
                    );
                  })}
                </div>
                {item.question?.explanation && (
                  <p style={{ marginTop: 16 }}>{linkifyMedicalTerms(item.question.explanation, [], () => {})}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

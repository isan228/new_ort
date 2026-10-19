import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { practiceApi } from '../../api/client';
import { isOrtGate } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import QuestionStem from '../../components/QuestionStem';
import MathText from '../../components/MathText';
import { COMPARE_LETTERS, compareAnswerText, isCompare } from '../../lib/compare';
import { SIM_LETTERS, formatClock } from '../sim/simShared';
import { FlagButton, useFlags } from './PracticeRunner';
import '../../styles/sim.css';
import '../../styles/practice.css';

function Row({ row, name, t }) {
  return (
    <tr>
      <td><b>{name}</b></td>
      <td data-label={t('practice.colTotal')}>{row.total || '—'}</td>
      <td data-label={t('simulation.colCorrect')}>{row.correct}</td>
      <td data-label={t('simulation.colWrong')}>{row.wrong}</td>
      <td data-label={t('simulation.colSkipped')}>{row.skipped}</td>
      <td data-label="%" className="sim-pct">
        {row.total ? <><span className="sim-bar"><i style={{ width: `${row.percent}%` }} /></span> {row.percent}%</> : '—'}
      </td>
    </tr>
  );
}

function Head({ t }) {
  return (
    <tr>
      <th>{t('practice.colTopic')}</th>
      <th>{t('practice.colTotal')}</th>
      <th>{t('simulation.colCorrect')}</th>
      <th>{t('simulation.colWrong')}</th>
      <th>{t('simulation.colSkipped')}</th>
      <th>%</th>
    </tr>
  );
}

function ReviewItem({ q, number, flagged, onFlag, t }) {
  const letters = isCompare(q) ? COMPARE_LETTERS : SIM_LETTERS;
  return (
    <article className={`card sim-review-item is-${q.status}`}>
      <header className="sim-review-head">
        <span className="sim-qnum">{number}</span>
        <span className={`sim-status is-${q.status}`}>{t(`simulation.status.${q.status}`)}</span>
        <span className="muted">{q.subjectName} · {q.topicName}</span>
        {!q.missing && <FlagButton on={flagged} onClick={onFlag} t={t} className="pr-flag-sm" />}
      </header>
      {q.missing ? <p className="muted">{t('practice.missing')}</p> : (
        <>
          <QuestionStem q={q} className="uworld-review-stem" />
          <div className="uworld-review-choices">
            {q.answers.map((a, i) => {
              const isUser = q.userAnswerId === a.id;
              let cls = 'uworld-review-choice';
              if (a.isCorrect) cls += ' is-correct';
              if (isUser && !a.isCorrect) cls += ' is-user-wrong';
              if (isUser && a.isCorrect) cls += ' is-user-correct';
              return (
                <div key={a.id} className={cls}>
                  <span className="uworld-review-choice-mark">{a.isCorrect ? '✓' : (isUser ? '✗' : '')}</span>
                  <span className="uworld-review-choice-letter">{letters[i]}.</span>
                  <span className="uworld-review-choice-text">
                    {isCompare(q) ? compareAnswerText(t, a, i) : <MathText text={a.text} />}
                    {a.imageUrl && <img className="q-media q-media-answer" src={a.imageUrl} alt="" />}
                  </span>
                  {isUser && <span className="sim-your">{t('simulation.yourAnswer')}</span>}
                </div>
              );
            })}
          </div>
          {(q.explanation?.trim() || q.explanationImageUrl) && (
            <div className="sim-explanation">
              <b>{t('simulation.explanation')}</b>
              {q.explanation?.trim() && <MathText text={q.explanation} />}
              {q.explanationImageUrl && <img className="q-media" src={q.explanationImageUrl} alt="" />}
            </div>
          )}
        </>
      )}
    </article>
  );
}

export default function PracticeResult() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('wrong');
  const [flags, setFlags, toggleFlag] = useFlags({});

  useEffect(() => {
    practiceApi.result(sessionId)
      .then((next) => {
        setData(next);
        setFlags(Object.fromEntries(next.review.map((q) => [q.id, !!q.flagged])));
      })
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else if (err.code === 'NOT_FINISHED') navigate(`/app/practice/${sessionId}`, { replace: true });
        else setError(err.message);
      });
  }, [navigate, sessionId, setFlags]);

  const visible = useMemo(() => {
    if (!data) return [];
    return data.review
      .map((q, i) => ({ q, number: i + 1 }))
      .filter(({ q }) => {
        if (filter === 'all') return true;
        if (filter === 'flagged') return flags[q.id];
        if (filter === 'wrong') return q.status !== 'correct';
        return q.status === filter;
      });
  }, [data, filter, flags]);

  if (!data) return <p className="muted">{error || t('common.loading')}</p>;
  const { result, reason } = data;

  return (
    <div className="sim-page sim-result">
      <Link className="muted" to="/app/create">← {t('practice.title')}</Link>
      <h1 style={{ marginTop: 10 }}>{t('practice.resultTitle')}</h1>
      <p className="muted">
        {t('practice.duration', { time: formatClock(result.durationSec) })}
        {reason === 'timeout' && ` · ${t('practice.timeUp')}`}
      </p>

      <div className="grid-4 sim-summary">
        <div className="card stat sim-stat-main"><b>{result.percent}%</b><span className="muted">{t('simulation.percentCorrect')}</span></div>
        <div className="card stat"><b>{result.correct}</b><span className="muted">{t('simulation.colCorrect')}</span></div>
        <div className="card stat"><b>{result.wrong}</b><span className="muted">{t('simulation.colWrong')}</span></div>
        <div className="card stat"><b>{result.skipped}</b><span className="muted">{t('simulation.colSkipped')}</span></div>
      </div>
      <p className="muted sim-hint">{t('simulation.notOfficial', { n: result.total })}</p>

      {result.subjects.length > 1 && (
        <div className="card table-scroll">
          <h3>{t('practice.bySubjects')}</h3>
          <table className="table sim-table">
            <thead><Head t={t} /></thead>
            <tbody>{result.subjects.map((s) => <Row key={s.subjectId} row={s} name={s.name} t={t} />)}</tbody>
          </table>
        </div>
      )}
      {result.subjects.map((s) => (
        <div key={s.subjectId} className="card table-scroll">
          <h3>{s.name} · {s.correct}/{s.total}</h3>
          <table className="table sim-table">
            <thead><Head t={t} /></thead>
            <tbody>{s.topics.map((topic) => <Row key={topic.testId} row={topic} name={topic.name} t={t} />)}</tbody>
          </table>
        </div>
      ))}

      <h2 style={{ marginTop: 28 }}>{t('simulation.review')}</h2>
      <div className="tabs">
        {['wrong', 'skipped', 'flagged', 'all'].map((key) => (
          <button key={key} type="button" className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>
            {t(`practice.reviewFilter.${key}`)}
          </button>
        ))}
      </div>
      {visible.map(({ q, number }) => (
        <ReviewItem key={q.id} q={q} number={number} flagged={!!flags[q.id]} onFlag={() => toggleFlag(q.id)} t={t} />
      ))}
      {!visible.length && <div className="empty">{t('simulation.filterEmpty')}</div>}

      <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
        <Link className="btn" to="/app/create">{t('practice.again')}</Link>
        {result.wrong > 0 && <Link className="btn ghost" to="/app/create?filter=incorrect">{t('practice.trainErrors')}</Link>}
      </div>
    </div>
  );
}

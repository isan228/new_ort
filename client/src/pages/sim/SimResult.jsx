import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { simApi } from '../../api/client';
import { isOrtGate } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import QuestionStem from '../../components/QuestionStem';
import MathText from '../../components/MathText';
import { COMPARE_LETTERS, compareAnswerText, isCompare } from '../../lib/compare';
import { Difficulty, SIM_LETTERS, formatClock, formatDate } from './simShared';
import '../../styles/sim.css';

function Bar({ percent }) {
  return <span className="sim-bar"><i style={{ width: `${percent}%` }} /></span>;
}

function ScoreCells({ row }) {
  return (
    <>
      <td><b>{row.correct}</b> / {row.total}</td>
      <td>{row.wrong}</td>
      <td>{row.skipped}</td>
      <td className="sim-pct"><Bar percent={row.percent} /> {row.percent}%</td>
    </>
  );
}

function ScoreHead({ t, first }) {
  return (
    <tr>
      <th>{first}</th>
      <th>{t('simulation.colCorrect')}</th>
      <th>{t('simulation.colWrong')}</th>
      <th>{t('simulation.colSkipped')}</th>
      <th>%</th>
    </tr>
  );
}

function ReviewItem({ q, number, passage, t }) {
  const letters = isCompare(q) ? COMPARE_LETTERS : SIM_LETTERS;
  const statusText = t(`simulation.status.${q.status}`);
  const hasExplanation = Boolean(q.explanation?.trim() || q.explanationImageUrl);
  return (
    <article className={`card sim-review-item is-${q.status}`}>
      <header className="sim-review-head">
        <span className="sim-qnum">{number}</span>
        <span className={`sim-status is-${q.status}`}>{statusText}</span>
        <span className="muted">{q.topicName ? `${q.partName} · ${q.topicName}` : q.partName}</span>
      </header>
      {passage && (
        <details className="sim-review-passage">
          <summary>{t('simulation.textOf', { title: passage.title })}</summary>
          <div className="sim-review-passage-body">
            {String(passage.body || '').split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </details>
      )}
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
      {hasExplanation && (
        <div className="sim-explanation">
          <b>{t('simulation.explanation')}</b>
          {q.explanation?.trim() && <MathText text={q.explanation} />}
          {q.explanationImageUrl && <img className="q-media" src={q.explanationImageUrl} alt="" />}
        </div>
      )}
    </article>
  );
}

export default function SimResult() {
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('wrong');

  useEffect(() => {
    simApi.result(attemptId)
      .then(setData)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else if (err.code === 'SIM_NOT_FINISHED') navigate(`/app/sim/attempt/${attemptId}`, { replace: true });
        else setError(err.message);
      });
  }, [attemptId, navigate]);

  const numbered = useMemo(() => {
    if (!data) return [];
    let n = 0;
    return data.review.blocks.map((block) => ({
      title: block.title,
      questions: block.questions.map((q) => { n += 1; return { q, number: n }; }),
    }));
  }, [data]);

  if (!data) return <p className="muted">{error || t('common.loading')}</p>;
  const { attempt, result, review } = data;
  const m = attempt.meta || {};
  const visible = (q) => filter === 'all' || (filter === 'wrong' ? q.status !== 'correct' : q.status === filter);

  return (
    <div className="sim-page sim-result">
      <Link className="muted" to={`/app/sim/variant/${attempt.variantId}`}>← {t('simulation.variantN', { n: m.number })}</Link>
      <h1 style={{ marginTop: 10 }}>
        {m.subjectName}
        {' · '}
        {t('simulation.variantN', { n: m.number })}
        {' '}
        {m.difficulty && <Difficulty t={t} value={m.difficulty} />}
      </h1>
      <p className="muted">{formatDate(attempt.finishedAt, locale)}</p>

      <div className="grid-4 sim-summary">
        <div className="card stat sim-stat-main"><b>{result.percent}%</b><span className="muted">{t('simulation.percentCorrect')}</span></div>
        <div className="card stat"><b>{result.correct}</b><span className="muted">{t('simulation.colCorrect')}</span></div>
        <div className="card stat"><b>{result.wrong}</b><span className="muted">{t('simulation.colWrong')}</span></div>
        <div className="card stat"><b>{result.skipped}</b><span className="muted">{t('simulation.colSkipped')}</span></div>
      </div>
      <p className="muted sim-hint">{t('simulation.notOfficial', { n: result.total })}</p>

      <div className="card table-scroll">
        <h3>{t('simulation.byBlocks')}</h3>
        <table className="table">
          <thead><ScoreHead t={t} first={t('simulation.colBlock')} /></thead>
          <tbody>
            {result.blocks.map((b, i) => (
              <tr key={b.title + i}>
                <td>
                  <b>{b.title}</b>
                  <div className="muted sim-cell-sub">
                    {t('simulation.spent', { used: formatClock(b.spentSec), n: b.minutes })}
                    {b.reason === 'timeout' && ` · ${t('simulation.closed.timeout')}`}
                  </div>
                </td>
                <ScoreCells row={b} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.parts.length > result.blocks.length && (
        <div className="card table-scroll">
          <h3>{t('simulation.byParts')}</h3>
          <table className="table">
            <thead><ScoreHead t={t} first={t('simulation.colPart')} /></thead>
            <tbody>
              {result.parts.map((p) => (
                <tr key={p.partId}>
                  <td><b>{p.name}</b></td>
                  <ScoreCells row={p} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.topics.length > 0 && (
        <div className="card table-scroll">
          <h3>{t('simulation.byTopics')}</h3>
          <table className="table">
            <thead><ScoreHead t={t} first={t('simulation.colTopic')} /></thead>
            <tbody>
              {result.topics.map((topic) => (
                <tr key={topic.topicId}>
                  <td>
                    <b>{topic.name}</b>
                    {topic.byBlock.length > 1 && (
                      <div className="muted sim-cell-sub">
                        {topic.byBlock.map((b) => `${b.title}: ${b.correct}/${b.total}`).join(' + ')}
                        {` = ${topic.correct}/${topic.total}`}
                      </div>
                    )}
                  </td>
                  <ScoreCells row={topic} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 28 }}>{t('simulation.review')}</h2>
      <div className="tabs">
        {['wrong', 'skipped', 'all'].map((key) => (
          <button key={key} type="button" className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>
            {t(`simulation.filter.${key}`)}
          </button>
        ))}
      </div>
      {numbered.map((block) => {
        const items = block.questions.filter(({ q }) => visible(q));
        if (!items.length) return null;
        return (
          <section key={block.title} className="sim-review-block">
            <h3>{block.title}</h3>
            {items.map(({ q, number }) => (
              <ReviewItem key={q.id} q={q} number={number} passage={q.passageId ? review.passages[q.passageId] : null} t={t} />
            ))}
          </section>
        );
      })}
      {!numbered.some((b) => b.questions.some(({ q }) => visible(q))) && <div className="empty">{t('simulation.filterEmpty')}</div>}

      <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
        <Link className="btn" to="/app/sim">{t('simulation.toCatalog')}</Link>
        <Link className="btn ghost" to={`/app/sim/variant/${attempt.variantId}`}>{t('simulation.variantN', { n: m.number })}</Link>
      </div>
    </div>
  );
}

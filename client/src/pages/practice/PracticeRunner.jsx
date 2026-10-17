import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { practiceApi } from '../../api/client';
import { isOrtGate } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import QuestionStem from '../../components/QuestionStem';
import MathText from '../../components/MathText';
import { COMPARE_LETTERS, compareAnswerText, isCompare } from '../../lib/compare';
import { SIM_LETTERS, formatClock } from '../sim/simShared';
import '../../styles/exam-uworld.css';
import '../../styles/sim.css';
import '../../styles/practice.css';

function IconMenu() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function IconPrev() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconNext() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function FlagButton({ on, onClick, t, className = '' }) {
  return (
    <button
      type="button"
      className={`pr-flag${on ? ' is-on' : ''} ${className}`}
      aria-pressed={on}
      title={on ? t('practice.unflag') : t('practice.flag')}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 21V4h11l-1.6 4L16 12H5" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <span>{on ? t('practice.flagged') : t('practice.flag')}</span>
    </button>
  );
}

export function useFlags(initial) {
  const [flags, setState] = useState(initial);
  const ref = useRef(initial);
  const setFlags = useCallback((value) => {
    ref.current = value;
    setState(value);
  }, []);
  const toggle = useCallback(async (questionId) => {
    const next = !ref.current[questionId];
    setFlags({ ...ref.current, [questionId]: next });
    try {
      await practiceApi.setFlag(questionId, next);
    } catch {
      setFlags({ ...ref.current, [questionId]: !next });
    }
  }, [setFlags]);
  return [flags, setFlags, toggle];
}

export default function PracticeRunner() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [state, setState] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const [revealed, setRevealed] = useState({});
  const [flags, setFlags, toggleFlag] = useFlags({});
  const [qnavOpen, setQnavOpen] = useState(true);
  const [timeUp, setTimeUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);
  const offset = useRef(0);
  const finishSent = useRef(false);

  const resultPath = `/app/practice/${sessionId}/result`;

  const load = useCallback(async () => {
    try {
      const next = await practiceApi.session(sessionId);
      if (next.status === 'finished') {
        if (next.reason === 'timeout') setTimeUp(true);
        else navigate(resultPath, { replace: true });
      }
      offset.current = Date.parse(next.serverNow) - Date.now();
      setPicked(next.answers || {});
      setRevealed(next.revealed || {});
      setFlags(Object.fromEntries(next.questions.map((q) => [q.id, !!q.flagged])));
      setState(next);
    } catch (err) {
      if (isOrtGate(err)) navigate('/app/premium');
      else setError(err.message);
    }
  }, [navigate, resultPath, sessionId, setFlags]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    document.body.classList.add('usmle-test-session', 'exam-open');
    return () => document.body.classList.remove('usmle-test-session', 'exam-open');
  }, []);

  useEffect(() => {
    if (!state) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const now = Date.now() + offset.current;
  const deadline = state?.deadline ? Date.parse(state.deadline) : null;
  const remaining = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;
  const elapsed = state ? Math.max(0, Math.round((now - Date.parse(state.createdAt)) / 1000)) : 0;
  const locked = timeUp || (remaining !== null && remaining <= 0);

  useEffect(() => {
    if (!locked || finishSent.current || !state) return;
    finishSent.current = true;
    setTimeUp(true);
    let stop = false;
    const record = async () => {
      try {
        const out = await practiceApi.finish(sessionId, true);
        if (!stop && out.status !== 'finished') setTimeout(record, 1500);
      } catch {
        if (!stop) setTimeout(record, 3000);
      }
    };
    record();
    return () => { stop = true; };
  }, [locked, sessionId, state]);

  async function choose(q, answerId) {
    if (locked || (state.config.instant && picked[q.id])) return;
    const prev = picked[q.id];
    if (prev === answerId) return;
    setPicked((p) => ({ ...p, [q.id]: answerId }));
    try {
      const out = await practiceApi.answer(sessionId, q.id, answerId);
      if (out.reveal) setRevealed((r) => ({ ...r, [q.id]: out.reveal }));
    } catch (err) {
      if (err.code === 'TIME_UP') { setTimeUp(true); return; }
      if (err.code === 'ANSWER_LOCKED' || err.code === 'SESSION_CLOSED') { load(); return; }
      setPicked((p) => ({ ...p, [q.id]: prev }));
      setError(t('simulation.saveFailed'));
    }
  }

  async function finish() {
    const left = state.questions.filter((q) => !picked[q.id]).length;
    const text = left ? t('practice.confirmFinishLeft', { n: left }) : t('practice.confirmFinish');
    if (!window.confirm(text)) return;
    setBusy(true);
    try {
      await practiceApi.finish(sessionId);
      navigate(resultPath);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (!state || timeUp) return;
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(state.questions.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, timeUp]);

  if (!state) return <div className="ort-exam-empty"><p>{error || t('common.loading')}</p></div>;

  const questions = state.questions;
  const safeIndex = Math.min(index, questions.length - 1);
  const q = questions[safeIndex];
  const answered = questions.filter((row) => picked[row.id]).length;
  const instant = !!state.config.instant;
  const shown = instant ? revealed[q.id] : null;
  const letters = isCompare(q) ? COMPARE_LETTERS : SIM_LETTERS;
  const last = safeIndex >= questions.length - 1;
  const warn = remaining !== null && remaining <= 60;

  return (
    <div className="ort-exam-root sim-runner pr-runner">
      <header className="uworld-session-topbar">
        <div className="uworld-tb-left">
          <button type="button" className={`uworld-tb-icon-btn ${qnavOpen ? 'is-active' : ''}`} onClick={() => setQnavOpen((v) => !v)} aria-label={t('runner.items')}>
            <IconMenu />
          </button>
          <div className="uworld-tb-item-info">
            <span className="uworld-tb-item-label">{t('runner.item', { a: safeIndex + 1, b: questions.length })}</span>
            <span className="uworld-tb-qid">{instant ? t('practice.modeInstant') : t('practice.modeTest')}</span>
          </div>
          {!q.missing && <FlagButton on={!!flags[q.id]} onClick={() => toggleFlag(q.id)} t={t} />}
        </div>
        <div className="uworld-tb-nav">
          <button type="button" className="uworld-tb-nav-btn" disabled={safeIndex <= 0} onClick={() => setIndex(safeIndex - 1)}>
            <IconPrev />
            <span>{t('runner.prev')}</span>
          </button>
          <button type="button" className="uworld-tb-nav-btn" disabled={last} onClick={() => setIndex(safeIndex + 1)}>
            <IconNext />
            <span>{t('runner.next')}</span>
          </button>
        </div>
        <div className={`sim-timer${warn ? ' is-warn' : ''}${locked ? ' is-over' : ''}`}>
          <span>{remaining !== null ? formatClock(remaining) : formatClock(elapsed)}</span>
        </div>
      </header>
      <div className="sim-progress"><i style={{ width: `${(answered / questions.length) * 100}%` }} /></div>

      <div className={`test-session-layout has-usmle-qnav${qnavOpen ? '' : ' qnav-collapsed'}`}>
        <aside className="usmle-qnav" aria-label={t('runner.items')}>
          <div className="usmle-qnav-title">{t('simulation.answeredN', { a: answered, b: questions.length })}</div>
          <ol className="usmle-qnav-list">
            {questions.map((item, i) => {
              let cls = 'usmle-qnav-item';
              if (i === safeIndex) cls += ' is-active';
              if (picked[item.id]) cls += ' is-answered';
              const r = instant && revealed[item.id];
              if (r) cls += r.correctAnswerId === picked[item.id] ? ' pr-ok' : ' pr-bad';
              return (
                <li key={item.id} className={cls}>
                  <button type="button" className="usmle-qnav-btn" onClick={() => setIndex(i)}>
                    <i className="usmle-qnav-dot" />
                    <span className="usmle-qnav-num">{i + 1}</span>
                    {flags[item.id] && <span className="pr-qnav-flag">⚑</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
        <div className="test-session-main">
          <div className="test-content">
            {error && <p className="err">{error}</p>}
            {q.missing ? <p className="muted">{t('practice.missing')}</p> : (
              <>
                <div className="sim-qnum">{safeIndex + 1}</div>
                {isCompare(q) && (
                  <div className="sim-compare-help">
                    <b>{t('simulation.compareTitle')}</b>
                    <ol>{COMPARE_LETTERS.map((l, i) => <li key={l}><b>({l})</b> {t(`simulation.compareRule${i}`)}</li>)}</ol>
                  </div>
                )}
                <QuestionStem q={q} className="usmle-question-stem" />
                <div className="answers-list" role="radiogroup">
                  {q.answers.map((a, i) => {
                    const selected = picked[q.id] === a.id;
                    let cls = `answer-item ${selected ? 'selected' : ''}`;
                    if (shown) {
                      if (a.id === shown.correctAnswerId) cls += ' pr-correct';
                      else if (selected) cls += ' pr-wrong';
                    }
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={locked || !!shown}
                        className={cls}
                        onClick={() => choose(q, a.id)}
                      >
                        <span className="answer-radio" aria-hidden="true" />
                        <span className="answer-option-text">
                          <span className="answer-option-letter">{letters[i]}.</span>
                          {' '}
                          {isCompare(q) ? compareAnswerText(t, a, i) : <MathText text={a.text} />}
                          {a.imageUrl && <img className="q-media q-media-answer" src={a.imageUrl} alt="" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {shown && (
                  <div className={`pr-feedback ${shown.correctAnswerId === picked[q.id] ? 'is-ok' : 'is-bad'}`}>
                    <b>{shown.correctAnswerId === picked[q.id] ? t('practice.right') : t('practice.wrong')}</b>
                    {(shown.explanation?.trim() || shown.explanationImageUrl) && (
                      <div className="sim-explanation">
                        <b>{t('simulation.explanation')}</b>
                        {shown.explanation?.trim() && <MathText text={shown.explanation} />}
                        {shown.explanationImageUrl && <img className="q-media" src={shown.explanationImageUrl} alt="" />}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="sim-bottom-nav">
              <button type="button" className="btn ghost" disabled={safeIndex <= 0} onClick={() => setIndex(safeIndex - 1)}>← {t('runner.prev')}</button>
              {last
                ? <button type="button" className="btn" disabled={busy || locked} onClick={finish}>{t('practice.finish')}</button>
                : <button type="button" className="btn" onClick={() => setIndex(safeIndex + 1)}>{t('runner.next')} →</button>}
            </div>
          </div>
        </div>
      </div>

      <footer className="uworld-session-footer">
        <div className="uworld-sf-left">
          <div className="uworld-sf-meta">
            <span className="uworld-sf-k">{remaining !== null ? t('simulation.timeLeft') : t('practice.elapsed')}</span>
            <span className={`uworld-sf-v uworld-sf-time ${warn ? 'uworld-sf-warn' : ''}`}>{remaining !== null ? formatClock(remaining) : formatClock(elapsed)}</span>
          </div>
        </div>
        <div className="uworld-sf-tools">
          <Link className="uworld-sf-tool" to="/app/create" title={t('practice.exitHint')}><span>{t('simulation.exit')}</span></Link>
          <button type="button" className="uworld-sf-tool uworld-sf-end" disabled={busy || locked} onClick={finish}>
            <span>{t('practice.finish')}</span>
          </button>
        </div>
      </footer>

      {timeUp && (
        <div className="pr-timeup" role="alertdialog" aria-modal="true">
          <div className="card">
            <h2>{t('practice.timeUp')}</h2>
            <p className="muted">{t('practice.timeUpText', { a: answered, b: questions.length })}</p>
            <button type="button" className="btn lg" onClick={() => navigate(resultPath)}>{t('practice.finish')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

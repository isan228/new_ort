import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { simApi } from '../../api/client';
import { isOrtGate } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import QuestionStem from '../../components/QuestionStem';
import MathText from '../../components/MathText';
import { PassageText } from '../../components/PassageText';
import { COMPARE_LETTERS, compareAnswerText, isCompare } from '../../lib/compare';
import { SIM_LETTERS, formatClock } from './simShared';
import '../../styles/exam-uworld.css';
import '../../styles/reading-book.css';
import '../../styles/sim.css';

function IconMenu() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function IconPrev() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconNext() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconClock() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function CompareInstruction({ t }) {
  return (
    <div className="sim-compare-help">
      <b>{t('simulation.compareTitle')}</b>
      <ol>
        {COMPARE_LETTERS.map((letter, i) => <li key={letter}><b>({letter})</b> {t(`simulation.compareRule${i}`)}</li>)}
      </ol>
    </div>
  );
}

function BlockIntro({ state, t, onStart, busy, error }) {
  const current = state.current;
  const block = state.blocks[current.index];
  return (
    <div className="ort-exam-root sim-runner">
      <header className="uworld-session-topbar">
        <div className="uworld-tb-left">
          <div className="uworld-tb-item-info">
            <span className="uworld-tb-item-label">{t('simulation.blockN', { a: current.index + 1, b: state.blocks.length })}</span>
          </div>
        </div>
      </header>
      <div className="ort-exam-gate">
        <div className="card exam-gate sim-intro">
          <span className="badge brand">{t('simulation.blockN', { a: current.index + 1, b: state.blocks.length })}</span>
          <h1>{block.title}</h1>
          <p>
            {t('simulation.qCount', { n: block.count })}
            {' · '}
            {t('simulation.minutes', { n: block.minutes })}
          </p>
          {current.parts.length > 1 && (
            <p className="muted">
              {current.parts.map((p) => `${p.name} — ${p.count}`).join(' · ')}
              {' · '}
              {t('simulation.sharedTimer')}
            </p>
          )}
          <ol className="sim-intro-blocks">
            {state.blocks.map((b, i) => (
              <li key={b.title + i} className={`is-${b.status}`}>
                <span>{b.title}</span>
                <small>{b.status === 'done' ? t(`simulation.closed.${b.reason || 'manual'}`) : t('simulation.minutes', { n: b.minutes })}</small>
              </li>
            ))}
          </ol>
          <p className="muted">{t('simulation.introHint')}</p>
          {error && <p className="err">{error}</p>}
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn lg" type="button" disabled={busy} onClick={onStart}>{t('simulation.startBlock')}</button>
            <Link className="btn ghost lg" to={`/app/sim/variant/${state.variantId}`}>{t('simulation.exit')}</Link>
          </div>
        </div>
      </div>
      <footer className="uworld-session-footer" />
    </div>
  );
}

export default function SimRunner() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const [state, setState] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const [qnavOpen, setQnavOpen] = useState(true);
  const [passageOpen, setPassageOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);
  const offset = useRef(0);
  const blockRef = useRef(null);
  const timeUpSent = useRef(false);

  const apply = useCallback((next) => {
    if (next.status === 'finished') {
      navigate(`/app/sim/attempt/${attemptId}/result`, { replace: true });
      return;
    }
    offset.current = Date.parse(next.serverNow) - Date.now();
    const key = `${next.current?.index}:${next.current?.phase}`;
    if (blockRef.current !== key) {
      blockRef.current = key;
      setIndex(0);
      timeUpSent.current = false;
    }
    setPicked(next.current?.answers || {});
    setState(next);
  }, [attemptId, navigate]);

  const load = useCallback(async () => {
    try {
      apply(await simApi.attempt(attemptId));
    } catch (err) {
      if (isOrtGate(err)) navigate('/app/premium');
      else setError(err.message);
    }
  }, [apply, attemptId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    document.body.classList.add('usmle-test-session', 'exam-open');
    return () => document.body.classList.remove('usmle-test-session', 'exam-open');
  }, []);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const current = state?.current;
  const running = current?.phase === 'running';
  const questions = running ? current.questions : [];
  const deadline = running ? Date.parse(current.deadline) : null;
  const remaining = deadline ? Math.max(0, Math.round((deadline - (Date.now() + offset.current)) / 1000)) : 0;
  const locked = running && remaining <= 0;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!locked || timeUpSent.current) return undefined;
    timeUpSent.current = true;
    let stop = false;
    const close = async () => {
      try {
        const next = await simApi.closeBlock(attemptId, current.index, true);
        if (stop) return;
        if (next.current?.phase === 'running' && next.current.index === current.index) {
          setTimeout(close, 2000);
          return;
        }
        apply(next);
      } catch (err) {
        if (!stop) setTimeout(close, 3000);
      }
    };
    close();
    return () => { stop = true; };
  }, [locked]);

  const passageOrder = useMemo(() => {
    const ids = [];
    for (const q of questions) if (q.passageId && !ids.includes(q.passageId)) ids.push(q.passageId);
    return ids;
  }, [questions]);

  async function act(fn) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      apply(await fn());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function choose(q, answerId) {
    if (locked) return;
    const prev = picked[q.id];
    if (prev === answerId) return;
    setPicked((p) => ({ ...p, [q.id]: answerId }));
    simApi.answer(attemptId, q.id, answerId).catch((err) => {
      if (err.code === 'SIM_BLOCK_CLOSED' || err.code === 'SIM_CLOSED') {
        load();
        return;
      }
      setPicked((p) => ({ ...p, [q.id]: prev }));
      setError(t('simulation.saveFailed'));
    });
  }

  function closeBlock() {
    const left = questions.filter((q) => !picked[q.id]).length;
    const last = current.index >= state.blocks.length - 1;
    const text = [
      left ? t('simulation.confirmCloseLeft', { n: left }) : t('simulation.confirmCloseAll'),
      last ? t('simulation.confirmLastBlock') : t('simulation.confirmNoReturn'),
    ].join('\n');
    if (!window.confirm(text)) return;
    act(() => simApi.closeBlock(attemptId, current.index));
  }

  function finishAll() {
    if (!window.confirm(t('simulation.confirmFinish'))) return;
    act(() => simApi.finish(attemptId));
  }

  useEffect(() => {
    function onKey(e) {
      if (!running) return;
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(questions.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, questions.length]);

  if (!state) {
    return <div className="ort-exam-empty"><p>{error || t('common.loading')}</p></div>;
  }
  if (current?.phase === 'intro') {
    return <BlockIntro state={state} t={t} busy={busy} error={error} onStart={() => act(() => simApi.startBlock(attemptId))} />;
  }
  if (!running || !questions.length) {
    return <div className="ort-exam-empty"><p>{error || t('common.loading')}</p></div>;
  }

  const safeIndex = Math.min(index, questions.length - 1);
  const q = questions[safeIndex];
  const block = state.blocks[current.index];
  const answered = questions.filter((row) => picked[row.id]).length;
  const passage = q.passageId ? current.passages[q.passageId] : null;
  const passageNo = passage ? passageOrder.indexOf(q.passageId) + 1 : 0;
  const warn = remaining <= 300;
  const lastQuestion = safeIndex >= questions.length - 1;

  return (
    <div className="ort-exam-root sim-runner">
      <header className="uworld-session-topbar">
        <div className="uworld-tb-left">
          <button type="button" className={`uworld-tb-icon-btn ${qnavOpen ? 'is-active' : ''}`} onClick={() => setQnavOpen((v) => !v)} aria-label={t('runner.items')}>
            <IconMenu />
          </button>
          <div className="uworld-tb-item-info">
            <span className="uworld-tb-item-label">{t('runner.item', { a: safeIndex + 1, b: questions.length })}</span>
            <span className="uworld-tb-qid">{t('simulation.blockN', { a: current.index + 1, b: state.blocks.length })} · {block.title}</span>
          </div>
        </div>
        <div className="uworld-tb-nav">
          <button type="button" className="uworld-tb-nav-btn" disabled={safeIndex <= 0} onClick={() => setIndex(safeIndex - 1)}>
            <IconPrev />
            <span>{t('runner.prev')}</span>
          </button>
          <button type="button" className="uworld-tb-nav-btn" onClick={() => (lastQuestion ? closeBlock() : setIndex(safeIndex + 1))}>
            <IconNext />
            <span>{lastQuestion ? t('simulation.closeBlock') : t('runner.next')}</span>
          </button>
        </div>
        <div className={`sim-timer${warn ? ' is-warn' : ''}${locked ? ' is-over' : ''}`} title={t('simulation.timeLeft')}>
          <IconClock />
          <span>{formatClock(remaining)}</span>
        </div>
      </header>
      <div className="sim-progress" title={t('simulation.answeredN', { a: answered, b: questions.length })}>
        <i style={{ width: `${(answered / questions.length) * 100}%` }} />
      </div>

      <div className={`test-session-layout has-usmle-qnav${qnavOpen ? '' : ' qnav-collapsed'}`}>
        <aside className="usmle-qnav" aria-label={t('runner.items')}>
          <div className="usmle-qnav-title">{t('simulation.answeredN', { a: answered, b: questions.length })}</div>
          <ol className="usmle-qnav-list">
            {questions.map((item, i) => {
              let cls = 'usmle-qnav-item';
              if (i === safeIndex) cls += ' is-active';
              if (picked[item.id]) cls += ' is-answered';
              return (
                <li key={item.id} className={cls}>
                  <button type="button" className="usmle-qnav-btn" onClick={() => setIndex(i)}>
                    <i className="usmle-qnav-dot" />
                    <span className="usmle-qnav-num">{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
        <div className="test-session-main">
          <div className={`test-content${passage ? ' sim-with-passage' : ''}`}>
            {passage && (
              <div className={`sim-passage${passageOpen ? '' : ' is-collapsed'}`}>
                <button type="button" className="btn ghost sm sim-passage-toggle" onClick={() => setPassageOpen((v) => !v)}>
                  {passageOpen ? t('simulation.hideText') : t('simulation.showText')}
                </button>
                <div className="rb rb-embed theme-light measure-normal">
                  <div className="rb-page rb-left">
                    <PassageText passage={passage} number={passageNo} pageNo={passageNo} t={t} />
                  </div>
                </div>
              </div>
            )}
            <div className="sim-question">
              {locked && <p className="err">{t('simulation.timeOver')}</p>}
              {error && <p className="err">{error}</p>}
              {current.parts.length > 1 && <p className="usmle-section-label">{q.partName}</p>}
              {isCompare(q) && <CompareInstruction t={t} />}
              <div className="sim-qnum">{safeIndex + 1}</div>
              <QuestionStem q={q} className="usmle-question-stem" />
              {isCompare(q) ? (
                <div className="sim-compare-answers" role="radiogroup">
                  {q.answers.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={picked[q.id] === a.id}
                      title={compareAnswerText(t, a, i)}
                      disabled={locked}
                      className={`sim-compare-option${picked[q.id] === a.id ? ' selected' : ''}`}
                      onClick={() => choose(q, a.id)}
                    >
                      <b>{COMPARE_LETTERS[i]}</b>
                      <span>{compareAnswerText(t, a, i)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="answers-list" role="radiogroup">
                  {q.answers.map((a, i) => {
                    const selected = picked[q.id] === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={locked}
                        className={`answer-item ${selected ? 'selected' : ''}`}
                        onClick={() => choose(q, a.id)}
                      >
                        <span className="answer-radio" aria-hidden="true" />
                        <span className="answer-option-text">
                          <span className="answer-option-letter">{SIM_LETTERS[i]}.</span>
                          {' '}
                          <MathText text={a.text} />
                          {a.imageUrl && <img className="q-media q-media-answer" src={a.imageUrl} alt="" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="sim-bottom-nav">
                <button type="button" className="btn ghost" disabled={safeIndex <= 0} onClick={() => setIndex(safeIndex - 1)}>← {t('runner.prev')}</button>
                {lastQuestion
                  ? <button type="button" className="btn" disabled={busy} onClick={closeBlock}>{t('simulation.closeBlock')}</button>
                  : <button type="button" className="btn" onClick={() => setIndex(safeIndex + 1)}>{t('runner.next')} →</button>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="uworld-session-footer">
        <div className="uworld-sf-left">
          <div className="uworld-sf-meta">
            <span className="uworld-sf-k">{t('simulation.timeLeft')}</span>
            <span className={`uworld-sf-v uworld-sf-time ${warn ? 'uworld-sf-warn' : ''}`}>{formatClock(remaining)}</span>
          </div>
          <div className="uworld-sf-meta">
            <span className="uworld-sf-k">{state.meta?.subjectName}</span>
            <span className="uworld-sf-v">{t('simulation.variantN', { n: state.meta?.number })}</span>
          </div>
        </div>
        <div className="uworld-sf-tools">
          <Link className="uworld-sf-tool" to={`/app/sim/variant/${state.variantId}`} title={t('simulation.exitHint')}>
            <span>{t('simulation.exit')}</span>
          </Link>
          <button type="button" className="uworld-sf-tool" disabled={busy} onClick={finishAll}>
            <span>{t('simulation.finishAll')}</span>
          </button>
          <button type="button" className="uworld-sf-tool uworld-sf-end" disabled={busy} onClick={closeBlock}>
            <span>{t('simulation.closeBlock')}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';
import { bumpToday, loadProgress, saveProgress, toggleFavorite } from '../lib/progress';
import '../styles/exam-uworld.css';

const SIM_KEY = 'ortSimState';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function readSimState() {
  try { return JSON.parse(sessionStorage.getItem(SIM_KEY) || 'null'); } catch { return null; }
}

function formatClock(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const hh = String(Math.floor(safe / 3600)).padStart(2, '0');
  const mm = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function IconMenu() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function IconPrev() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconNext() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconFull() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconEnd() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" /><rect x="8.2" y="8.2" width="7.6" height="7.6" rx="1" fill="#fff" /></svg>;
}
function IconFlag() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h1.2l.4 1.2A3.2 3.2 0 0 0 9.6 7H19v8h-8.4a3.2 3.2 0 0 0-2.9 1.8L7.2 18H5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
function IconExit() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M14 16l5-4-5-4M19 12H10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function TestRunner() {
  const { bank } = useBank();
  const { t } = useLang();
  const navigate = useNavigate();
  const session = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('ortSession') || 'null'); } catch { return null; }
  }, []);
  const sections = session?.sections || [];
  const simulation = !!(session?.simulation && sections.length);
  const examMode = !!session?.examMode || simulation;

  const saved = useMemo(() => {
    const state = readSimState();
    if (!simulation || !state || state.startedAt !== session?.startedAt) return null;
    return state;
  }, [simulation, session]);

  const [sectionIdx, setSectionIdx] = useState(saved?.sectionIdx || 0);
  const [index, setIndex] = useState(() => {
    if (saved?.index != null) return saved.index;
    return sections[0]?.start || 0;
  });
  const [picked, setPicked] = useState(saved?.picked || {});
  const [flagged, setFlagged] = useState(saved?.flagged || {});
  const [qnavOpen, setQnavOpen] = useState(true);
  const [phase, setPhase] = useState('running');
  const [error, setError] = useState('');
  const [left, setLeft] = useState(() => {
    if (saved?.left != null) return saved.left;
    if (simulation) return Math.round((sections[0]?.minutes || 20) * 60);
    const minutes = Number(session?.minutes);
    if (!minutes) return null;
    return Math.round(minutes * 60);
  });
  const timed = left != null;
  const [elapsed, setElapsed] = useState(() => (
    session?.startedAt ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)) : 0
  ));
  const finishing = useRef(false);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  const section = sections[sectionIdx] || null;
  const sectionStart = section?.start || 0;
  const sectionEnd = section ? section.start + section.count : (session?.questions?.length || 0);

  useEffect(() => {
    document.body.classList.add('usmle-test-session', 'exam-open');
    return () => document.body.classList.remove('usmle-test-session', 'exam-open');
  }, []);

  useEffect(() => {
    if (!session?.questions || phase !== 'running') return undefined;
    const timer = setInterval(() => {
      if (left != null) setLeft((s) => Math.max(0, s - 1));
      if (session.startedAt) setElapsed(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [session, phase, sectionIdx, left == null]);

  useEffect(() => {
    if (!simulation) return;
    sessionStorage.setItem(SIM_KEY, JSON.stringify({
      startedAt: session.startedAt,
      sectionIdx,
      index,
      picked,
      flagged,
      left,
    }));
  }, [simulation, session, sectionIdx, index, picked, flagged, left]);

  async function finish() {
    if (finishing.current || !session?.questions) return;
    finishing.current = true;
    const answers = session.questions.map((item) => ({
      questionId: item.id,
      answerId: pickedRef.current[item.id] || null,
    }));
    try {
      const body = {
        answers,
        questionMode: session.questionMode,
        durationSec: Math.round((Date.now() - session.startedAt) / 1000),
        examType: session.examType,
        testId: session.test?.id,
      };
      const data = session.examType === 'main' || session.examType === 'custom' || !session.test?.id
        ? await ortApi.checkExam(body)
        : await ortApi.check(session.test.id, body);
      bumpToday(answers.filter((a) => a.answerId).length);
      sessionStorage.removeItem(SIM_KEY);
      sessionStorage.setItem('ortResult', JSON.stringify({
        ...data,
        examMode,
        simulation,
        bank: bank?.name || session.test?.name,
      }));
      const p = loadProgress();
      p.lastResultId = data.resultId;
      saveProgress(p);
      navigate('/app/results');
    } catch (err) {
      finishing.current = false;
      setError(err.message);
    }
  }

  function closeSection() {
    if (sectionIdx >= sections.length - 1) {
      finish();
      return;
    }
    setPhase('gate');
  }

  function openNextSection() {
    const next = sectionIdx + 1;
    const nextSection = sections[next];
    setSectionIdx(next);
    setIndex(nextSection.start);
    setLeft(Math.round(nextSection.minutes * 60));
    setPhase('running');
  }

  useEffect(() => {
    if (left == null || left !== 0 || phase !== 'running' || !session?.questions) return;
    if (simulation) closeSection();
    else finish();
  }, [left]);

  function goInSection(next) {
    if (next < sectionStart || next >= sectionEnd) return;
    setIndex(next);
  }

  function skip() {
    if (!session?.questions?.[index]) return;
    const p = loadProgress();
    p.skipped = [...new Set([...(p.skipped || []), session.questions[index].id])];
    saveProgress(p);
    if (index < sectionEnd - 1) setIndex(index + 1);
  }

  function goNext() {
    if (index < sectionEnd - 1) {
      goInSection(index + 1);
      return;
    }
    if (simulation && sectionIdx < sections.length - 1) closeSection();
    else finish();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  useEffect(() => {
    function onKey(e) {
      if (phase !== 'running') return;
      if (e.key === 'ArrowLeft') goInSection(index - 1);
      if (e.key === 'ArrowRight' && index < sectionEnd - 1) goInSection(index + 1);
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, phase, sectionEnd, sectionStart]);

  if (!session?.questions?.length) {
    return (
      <div className="ort-exam-empty">
        <p>{t('runner.empty')} <Link to="/app/tests">{t('runner.collect')}</Link>.</p>
      </div>
    );
  }

  const questions = session.questions;
  const q = questions[index];
  const localIndex = index - sectionStart;
  const total = section?.count || questions.length;
  const warn = left != null && left <= 60;
  const lastInSection = index >= sectionEnd - 1;
  const nextLabel = lastInSection
    ? (simulation && sectionIdx < sections.length - 1 ? t('sim.endSection') : t('runner.end'))
    : t('runner.next');
  const modeLabel = simulation ? t('runner.modeSim') : (examMode ? t('runner.modeExam') : t('runner.modeTutor'));

  if (phase === 'gate' && section) {
    const next = sections[sectionIdx + 1];
    return (
      <div className="ort-exam-root">
        <header className="uworld-session-topbar">
          <div className="uworld-tb-left">
            <div className="uworld-tb-item-info">
              <span className="uworld-tb-item-label">{t('sim.sectionClosed')}</span>
            </div>
          </div>
        </header>
        <div className="ort-exam-gate">
          <div className="card exam-gate">
            <h1>{section.title}</h1>
            <p>{t('sim.gateText')}</p>
            {next && (
              <p>
                <b>{t('sim.nextSection')}</b>
                {' '}
                {next.title}
                {' · '}
                {t('sim.minutes', { n: next.minutes })}
                {' · '}
                {t('sim.qCount', { n: next.count })}
              </p>
            )}
            <button className="btn" type="button" onClick={openNextSection}>{t('sim.continue')}</button>
          </div>
        </div>
        <footer className="uworld-session-footer" />
      </div>
    );
  }

  return (
    <div className="ort-exam-root">
      <header className="uworld-session-topbar">
        <div className="uworld-tb-left">
          <button
            type="button"
            className={`uworld-tb-icon-btn ${qnavOpen ? 'is-active' : ''}`}
            title={t('runner.exit')}
            onClick={() => setQnavOpen((v) => !v)}
          >
            <IconMenu />
          </button>
          <div className="uworld-tb-item-info">
            <span className="uworld-tb-item-label">{t('runner.item', { a: localIndex + 1, b: total })}</span>
            <span className="uworld-tb-qid">{t('runner.qid', { id: q.id })}</span>
          </div>
          <button
            type="button"
            className={`uworld-tb-mark ${flagged[q.id] ? 'is-active' : ''}`}
            onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))}
          >
            <IconFlag />
            <span className="uworld-tb-mark-text">{flagged[q.id] ? t('runner.unflag') : t('runner.mark')}</span>
          </button>
        </div>
        <div className="uworld-tb-nav">
          <button type="button" className="uworld-tb-nav-btn" disabled={index <= sectionStart} onClick={() => goInSection(index - 1)}>
            <IconPrev />
            <span>{t('runner.prev')}</span>
          </button>
          <button type="button" className="uworld-tb-nav-btn" onClick={goNext}>
            <IconNext />
            <span>{nextLabel}</span>
          </button>
        </div>
        <div className="uworld-tb-tools">
          <button type="button" className="uworld-tb-tool" onClick={toggleFullscreen}>
            <IconFull />
            <span className="uworld-tb-tool-full">{t('runner.fullscreen')}</span>
            <span className="uworld-tb-tool-short">{t('runner.fullscreen')}</span>
          </button>
          {!simulation && (
            <button type="button" className="uworld-tb-tool" onClick={() => toggleFavorite(q.id)}>
              <span className="uworld-tb-mark-icon">★</span>
              <span>{t('runner.fav')}</span>
            </button>
          )}
          <button type="button" className="uworld-tb-tool" onClick={skip}>
            <span className="uworld-tb-mark-icon">↷</span>
            <span>{t('runner.skip')}</span>
          </button>
        </div>
      </header>

      <div className={`test-session-layout has-usmle-qnav${qnavOpen ? '' : ' qnav-collapsed'}`}>
        <aside className="usmle-qnav" aria-label="Questions">
          <div className="usmle-qnav-title">{t('runner.items')}</div>
          <ol className="usmle-qnav-list">
            {questions.slice(sectionStart, sectionEnd).map((item, i) => {
              const abs = sectionStart + i;
              let cls = 'usmle-qnav-item';
              if (abs === index) cls += ' is-active';
              if (picked[item.id]) cls += ' is-answered';
              if (flagged[item.id]) cls += ' is-favorite';
              return (
                <li key={item.id} className={cls}>
                  <button type="button" className="usmle-qnav-btn" onClick={() => goInSection(abs)}>
                    <i className="usmle-qnav-dot" />
                    <span className="usmle-qnav-num">{i + 1}</span>
                    {flagged[item.id] && <span className="usmle-qnav-flag">⚑</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
        <div className="test-session-main">
          <div className="test-content">
            {error && <p className="err">{error}</p>}
            {simulation && section && (
              <p className="usmle-section-label">{section.title}</p>
            )}
            <div className="usmle-question-stem">{q.text}</div>
            <div className="answers-list" role="radiogroup" aria-label={t('runner.items')}>
              {q.answers.map((a, i) => {
                const selected = picked[q.id] === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`answer-item ${selected ? 'selected' : ''}`}
                    onClick={() => setPicked((prev) => ({ ...prev, [q.id]: a.id }))}
                  >
                    <span className="answer-radio" aria-hidden="true" />
                    <span className="answer-option-text">
                      <span className="answer-option-letter">{LETTERS[i]}.</span>
                      {' '}
                      {a.text}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="usmle-submit-row">
              <button
                type="button"
                className="usmle-submit-btn"
                disabled={!picked[q.id]}
                onClick={goNext}
              >
                {t('runner.submit')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="uworld-session-footer">
        <div className="uworld-sf-left">
          <div className="uworld-sf-meta">
            {timed ? (
              <>
                <span className="uworld-sf-k uworld-sf-k-full">{t('runner.blockTimeLabel')}</span>
                <span className="uworld-sf-k uworld-sf-k-short">{t('runner.remainShort')}</span>
                <span className={`uworld-sf-v uworld-sf-time ${warn ? 'uworld-sf-warn' : ''}`}>{formatClock(left)}</span>
              </>
            ) : (
              <>
                <span className="uworld-sf-k uworld-sf-k-full">{t('runner.blockElapsedLabel')}</span>
                <span className="uworld-sf-k uworld-sf-k-short">{t('runner.elapsedShort')}</span>
                <span className="uworld-sf-v uworld-sf-time">{formatClock(elapsed)}</span>
              </>
            )}
          </div>
          <div className="uworld-sf-meta">
            <span className="uworld-sf-k">{modeLabel}</span>
            {simulation && section && <span className="uworld-sf-v">{section.title}</span>}
          </div>
        </div>
        <div className="uworld-sf-tools">
          <button type="button" className="uworld-sf-tool" onClick={() => navigate('/app/tests')}>
            <IconExit />
            <span>{t('runner.exit')}</span>
          </button>
          <button
            type="button"
            className="uworld-sf-tool uworld-sf-end"
            onClick={() => (simulation ? closeSection() : finish())}
          >
            <IconEnd />
            <span className="uworld-sf-tool-full">{simulation ? t('sim.endSection') : t('runner.end')}</span>
            <span className="uworld-sf-tool-short">{t('runner.end')}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

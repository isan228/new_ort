import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';
import { bumpToday, loadProgress, saveProgress, toggleFavorite } from '../lib/progress';

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
    if (!session?.questions || phase !== 'running') return undefined;
    const timer = setInterval(() => {
      if (left != null) setLeft((s) => Math.max(0, s - 1));
      if (session.startedAt) setElapsed(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [session, phase, sectionIdx, left == null]);

  useEffect(() => {
    document.body.classList.add('exam-open');
    return () => document.body.classList.remove('exam-open');
  }, []);

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

  function submitCurrent() {
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
        submitCurrent();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, phase, sectionEnd, sectionStart]);

  if (!session?.questions?.length) {
    return (
      <div className="exam-empty">
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
  const modeLabel = simulation ? t('runner.modeSim') : (examMode ? t('runner.modeExam') : t('runner.modeTutor'));

  if (phase === 'gate' && section) {
    const next = sections[sectionIdx + 1];
    return (
      <div className="exam-lab">
        <header className="exam-top"><b>{t('sim.sectionClosed')}</b></header>
        <div className="exam-gate-wrap">
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
        <footer className="exam-bot" />
      </div>
    );
  }

  return (
    <div className="exam-lab">
      <header className="exam-top">
        <button type="button" className="exam-ico" title={t('runner.exit')} onClick={() => navigate('/app/tests')}>←</button>
        <div className="exam-meta">
          <b>{t('runner.item', { a: localIndex + 1, b: total })}</b>
          <span>{t('runner.qid', { id: q.id })}</span>
          {simulation && section && <span className="exam-top-sec">{section.title}</span>}
        </div>
        <button
          type="button"
          className={`exam-tool ${flagged[q.id] ? 'on' : ''}`}
          onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))}
        >
          <span className="exam-tool-ico">⚑</span>
          <span>{flagged[q.id] ? t('runner.unflag') : t('runner.mark')}</span>
        </button>
        <div className="exam-nav">
          <button type="button" className="exam-nav-btn" disabled={index <= sectionStart} onClick={() => goInSection(index - 1)}>
            ‹ {t('runner.prev')}
          </button>
          <button
            type="button"
            className="exam-nav-btn"
            disabled={lastInSection}
            onClick={() => goInSection(index + 1)}
          >
            {t('runner.next')} ›
          </button>
        </div>
        <div className="exam-tools">
          {!simulation && (
            <button type="button" className="exam-tool" onClick={() => toggleFavorite(q.id)}>
              <span className="exam-tool-ico">★</span>
              <span>{t('runner.fav')}</span>
            </button>
          )}
          <button type="button" className="exam-tool" onClick={skip}>
            <span className="exam-tool-ico">↷</span>
            <span>{t('runner.skip')}</span>
          </button>
          <button type="button" className="exam-tool" onClick={toggleFullscreen}>
            <span className="exam-tool-ico">⛶</span>
            <span>{t('runner.fullscreen')}</span>
          </button>
        </div>
      </header>

      <div className="exam-body">
        <aside className="exam-side">
          {questions.slice(sectionStart, sectionEnd).map((item, i) => {
            const abs = sectionStart + i;
            let cls = 'exam-num';
            if (abs === index) cls += ' on';
            if (picked[item.id]) cls += ' done';
            if (flagged[item.id]) cls += ' flag';
            return (
              <button key={item.id} type="button" className={cls} onClick={() => goInSection(abs)}>
                <span>{i + 1}</span>
                {picked[item.id] ? <i className="exam-dot" /> : <i className="exam-dot empty" />}
              </button>
            );
          })}
        </aside>
        <main className="exam-main">
          {error && <p className="err">{error}</p>}
          <p className="exam-stem">{q.text}</p>
          <div className="exam-opts">
            {q.answers.map((a, i) => (
              <button
                key={a.id}
                type="button"
                className={`exam-opt ${picked[q.id] === a.id ? 'on' : ''}`}
                onClick={() => setPicked((prev) => ({ ...prev, [q.id]: a.id }))}
              >
                <i className="exam-radio" />
                <span><b>({LETTERS[i]})</b> {a.text}</span>
              </button>
            ))}
          </div>
          <button className="exam-submit" type="button" onClick={submitCurrent}>
            {lastInSection
              ? (simulation && sectionIdx < sections.length - 1 ? t('sim.endSection') : t('runner.end'))
              : t('runner.submit')}
          </button>
        </main>
      </div>

      <footer className="exam-bot">
        <div className="exam-bot-left">
          <div>
            {timed
              ? <span className={warn ? 'warn' : ''}>{t('runner.blockTime', { time: formatClock(left) })}</span>
              : <span>{t('runner.blockElapsed', { time: formatClock(elapsed) })}</span>}
          </div>
          <small>{modeLabel}</small>
        </div>
        <span className="exam-bot-spacer" />
        <button type="button" className="exam-tool" onClick={() => (simulation ? closeSection() : finish())}>
          <span className="exam-tool-ico">⏻</span>
          <span>{simulation ? t('sim.endSection') : t('runner.end')}</span>
        </button>
      </footer>
    </div>
  );
}

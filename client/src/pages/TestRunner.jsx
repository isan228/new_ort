import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';
import { bumpToday, loadProgress, saveProgress, toggleFavorite } from '../lib/progress';

const SIM_KEY = 'ortSimState';

function readSimState() {
  try { return JSON.parse(sessionStorage.getItem(SIM_KEY) || 'null'); } catch { return null; }
}

function formatClock(sec) {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
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
  const examMode = !!session?.examMode;
  const finishing = useRef(false);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  const section = sections[sectionIdx] || null;
  const sectionStart = section?.start || 0;
  const sectionEnd = section ? section.start + section.count : (session?.questions?.length || 0);

  useEffect(() => {
    if (!session?.questions || phase !== 'running' || left == null) return undefined;
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
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

  if (!session?.questions?.length) {
    return <p>{t('runner.empty')} <Link to="/app/tests">{t('runner.collect')}</Link>.</p>;
  }

  const questions = session.questions;
  const q = questions[index];
  const localIndex = index - sectionStart;
  const warn = left != null && left <= 60;

  function skip() {
    const p = loadProgress();
    p.skipped = [...new Set([...(p.skipped || []), q.id])];
    saveProgress(p);
    if (index < sectionEnd - 1) setIndex(index + 1);
  }

  function goInSection(next) {
    if (next < sectionStart || next >= sectionEnd) return;
    setIndex(next);
  }

  if (phase === 'gate' && section) {
    const next = sections[sectionIdx + 1];
    return (
      <div className="card exam-gate">
        <span className="badge">{t('sim.sectionClosed')}</span>
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
        <button className="btn" type="button" onClick={openNextSection}>
          {t('sim.continue')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="muted">{simulation ? t('sim.title') : (bank?.name || session.test?.name)}</div>
          {simulation && section && (
            <div className="exam-section-name">
              {t('sim.sectionN', { a: sectionIdx + 1, b: sections.length })}
              {' · '}
              {section.title}
            </div>
          )}
          <b>
            {simulation
              ? t('runner.q', { a: localIndex + 1, b: section?.count || questions.length })
              : t('runner.q', { a: index + 1, b: questions.length })}
          </b>
        </div>
        {timed && (
          <span className={`badge ${warn ? 'bad' : 'brand'}`}>
            {simulation ? t('sim.sectionLeft', { time: formatClock(left) }) : t('runner.left', { time: formatClock(left) })}
          </span>
        )}
      </div>
      {simulation && (
        <div className="exam-section-pips">
          {sections.map((item, i) => (
            <span key={item.key} className={`exam-pip ${i === sectionIdx ? 'on' : ''} ${i < sectionIdx ? 'done' : ''}`}>
              {item.title}
            </span>
          ))}
        </div>
      )}
      <div className="progress" style={{ margin: '12px 0 20px' }}>
        <i style={{ width: `${((localIndex + 1) / (section?.count || questions.length)) * 100}%` }} />
      </div>
      {error && <p className="err">{error}</p>}
      <p className="q-text">{q.text}</p>
      <div style={{ display: 'grid', gap: 10, margin: '18px 0' }}>
        {q.answers.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`answer ${picked[q.id] === a.id ? 'on' : ''}`}
            onClick={() => setPicked((prev) => ({ ...prev, [q.id]: a.id }))}
          >
            {a.text}
          </button>
        ))}
      </div>
      {!examMode && picked[q.id] && <p className="muted">{t('runner.saved')}</p>}
      <div className="row test-actions" style={{ marginBottom: 16 }}>
        <button className="btn ghost" type="button" disabled={index <= sectionStart} onClick={() => goInSection(index - 1)}>
          {t('runner.back')}
        </button>
        <button className="btn ghost" type="button" onClick={skip}>{t('runner.skip')}</button>
        <button className="btn purple" type="button" onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))}>
          {flagged[q.id] ? t('runner.unflag') : t('runner.flag')}
        </button>
        {!simulation && (
          <button className="btn ghost" type="button" onClick={() => toggleFavorite(q.id)}>{t('runner.fav')}</button>
        )}
        {index < sectionEnd - 1
          ? <button className="btn" type="button" onClick={() => goInSection(index + 1)}>{t('runner.next')}</button>
          : simulation && sectionIdx < sections.length - 1
            ? <button className="btn" type="button" onClick={closeSection}>{t('sim.endSection')}</button>
            : <button className="btn" type="button" onClick={finish}>{t('runner.finish')}</button>}
      </div>
      <div className="q-nav">
        {questions.slice(sectionStart, sectionEnd).map((item, i) => {
          const abs = sectionStart + i;
          let cls = 'q-dot';
          if (abs === index) cls += ' on';
          else if (picked[item.id]) cls += ' done';
          if (flagged[item.id]) cls += ' flag';
          return (
            <button key={item.id} type="button" className={cls} onClick={() => goInSection(abs)}>{i + 1}</button>
          );
        })}
      </div>
    </div>
  );
}

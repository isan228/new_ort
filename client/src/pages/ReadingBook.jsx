import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { PassageText } from '../components/PassageText';
import { LETTERS, findEvidence, formatClock, splitParagraphs } from '../lib/reading';
import '../styles/reading-book.css';

const SETTINGS_KEY = 'ortReadingSettings';
const DEFAULT_SETTINGS = { font: 19, leading: 1.75, width: 'normal', theme: 'light', focus: false };
const LEADINGS = [1.55, 1.75, 1.95];
const WIDTHS = ['narrow', 'normal', 'wide'];

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function Svg({ d, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  close: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cross: 'M7 7l10 10M17 7L7 17',
  marker: 'M4 20h7M14.5 4.5l5 5L10 19H5v-5l9.5-9.5Z',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

function SettingsPanel({ settings, update, onClose, t }) {
  return (
    <>
      <button type="button" className="rb-scrim" aria-label={t('reading.close')} onClick={onClose} />
      <div className="rb-settings" role="dialog" aria-label={t('reading.settings')}>
        <div className="rb-settings-head">
          <b>{t('reading.settings')}</b>
          <button type="button" className="rb-icon" onClick={onClose} aria-label={t('reading.close')}><Svg d={ICONS.close} /></button>
        </div>

        <div className="rb-set">
          <span>{t('reading.fontSize')}</span>
          <div className="rb-stepper">
            <button type="button" onClick={() => update({ font: Math.max(15, settings.font - 1) })} aria-label="A-">A−</button>
            <input
              type="range"
              min="15"
              max="25"
              value={settings.font}
              onChange={(e) => update({ font: Number(e.target.value) })}
            />
            <button type="button" onClick={() => update({ font: Math.min(25, settings.font + 1) })} aria-label="A+">A+</button>
          </div>
        </div>

        <div className="rb-set">
          <span>{t('reading.leading')}</span>
          <div className="rb-seg">
            {LEADINGS.map((value, i) => (
              <button key={value} type="button" className={settings.leading === value ? 'on' : ''} onClick={() => update({ leading: value })}>
                <i className={`rb-lines l${i}`} aria-hidden="true"><b /><b /><b /></i>
              </button>
            ))}
          </div>
        </div>

        <div className="rb-set">
          <span>{t('reading.width')}</span>
          <div className="rb-seg">
            {WIDTHS.map((value) => (
              <button key={value} type="button" className={settings.width === value ? 'on' : ''} onClick={() => update({ width: value })}>
                {t(`reading.${value}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="rb-set">
          <span>{t('reading.theme')}</span>
          <div className="rb-seg">
            {['light', 'dark'].map((value) => (
              <button key={value} type="button" className={settings.theme === value ? 'on' : ''} onClick={() => update({ theme: value })}>
                <i className={`rb-swatch ${value}`} aria-hidden="true" />
                {t(`reading.${value}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="rb-switch">
          <span>
            <b>{t('reading.focus')}</b>
            <small>{t('reading.focusHint')}</small>
          </span>
          <input type="checkbox" checked={settings.focus} onChange={(e) => update({ focus: e.target.checked })} />
          <i aria-hidden="true" />
        </label>
      </div>
    </>
  );
}

function QuestionDots({ questions, current, results, onPick }) {
  return (
    <div className="rb-dots">
      {questions.map((q, i) => {
        const r = results[q.id];
        const cls = [
          'rb-dot',
          i === current ? 'on' : '',
          r ? (r.correct ? 'ok' : 'bad') : '',
        ].join(' ');
        return (
          <button key={q.id} type="button" className={cls} onClick={() => onPick(i)} aria-label={String(i + 1)}>
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

export default function ReadingBook() {
  const { testId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const isMobile = useMedia('(max-width: 860px)');

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pIdx, setPIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState({});
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [menu, setMenu] = useState(false);
  const [view, setView] = useState('text');
  const [flip, setFlip] = useState('');
  const [turn, setTurn] = useState('fwd');
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(Date.now());
  const startedAt = useRef(Date.now());
  const passageStartedAt = useRef(Date.now());
  const submitted = useRef(new Set());
  const markRef = useRef(null);

  useEffect(() => {
    let stop = false;
    ortApi.reading(testId)
      .then((payload) => {
        if (stop) return;
        setData(payload);
        const wanted = Number(params.get('p'));
        const at = payload.passages.findIndex((p) => p.id === wanted);
        if (at > 0) setPIdx(at);
      })
      .catch((err) => {
        if (stop) return;
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const passages = data?.passages || [];
  const passage = passages[pIdx];
  const questions = passage?.questions || [];
  const q = questions[qIdx];
  const result = q ? results[q.id] : null;
  const paragraphs = useMemo(() => splitParagraphs(passage?.body), [passage?.body]);
  const ranges = useMemo(
    () => (showEvidence && result?.evidence ? findEvidence(paragraphs, result.evidence) : []),
    [paragraphs, result?.evidence, showEvidence],
  );
  const totalQuestions = passages.reduce((sum, p) => sum + p.questions.length, 0);
  const answeredCount = Object.keys(results).length;
  const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;
  const isLastQuestion = qIdx === questions.length - 1;
  const isLastPassage = pIdx === passages.length - 1;
  const hideQuestions = settings.focus;

  useEffect(() => {
    if (!ranges.length) return;
    const id = requestAnimationFrame(() => {
      markRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [ranges, view]);

  function update(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function switchView(next) {
    if (next === view) return;
    setFlip(next === 'question' ? 'to-question' : 'to-text');
    setView(next);
  }

  const goTo = useCallback((nextP, nextQ, dir) => {
    setTurn(dir);
    if (nextP !== pIdx) {
      setPIdx(nextP);
      passageStartedAt.current = Date.now();
      if (isMobile) {
        setFlip(dir === 'fwd' ? 'to-text' : 'to-question');
        setView(dir === 'fwd' ? 'text' : 'question');
      }
    }
    setQIdx(nextQ);
    const nextQuestion = passages[nextP]?.questions[nextQ];
    setShowEvidence(Boolean(nextQuestion && results[nextQuestion.id]?.evidence));
  }, [isMobile, pIdx, passages, results]);

  function recordPassage(target, nextResults) {
    if (submitted.current.has(target.id)) return;
    if (!target.questions.every((item) => nextResults[item.id])) return;
    submitted.current.add(target.id);
    ortApi.checkExam({
      testId: Number(testId),
      questionMode: 'reading',
      durationSec: Math.round((Date.now() - passageStartedAt.current) / 1000),
      answers: target.questions.map((item) => ({
        questionId: item.id,
        answerId: nextResults[item.id].answerId,
      })),
    }).catch(() => {});
  }

  async function submit() {
    if (!q || result || !picked[q.id] || busy) return;
    setBusy(true);
    try {
      const res = await ortApi.readingAnswer(q.id, picked[q.id]);
      const nextResults = { ...results, [q.id]: res };
      setResults(nextResults);
      setShowEvidence(Boolean(res.evidence));
      recordPassage(passage, nextResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!isLastQuestion) goTo(pIdx, qIdx + 1, 'fwd');
    else if (!isLastPassage) goTo(pIdx + 1, 0, 'fwd');
    else setDone(true);
  }

  function prev() {
    if (qIdx > 0) goTo(pIdx, qIdx - 1, 'back');
    else if (pIdx > 0) goTo(pIdx - 1, passages[pIdx - 1].questions.length - 1, 'back');
  }

  function toggleEvidence() {
    if (isMobile) {
      setShowEvidence(true);
      switchView('text');
      return;
    }
    setShowEvidence(!showEvidence);
  }

  function restart() {
    setPicked({});
    setResults({});
    setShowEvidence(false);
    setDone(false);
    setPIdx(0);
    setQIdx(0);
    setView('text');
    submitted.current = new Set();
    startedAt.current = Date.now();
    passageStartedAt.current = Date.now();
  }

  useEffect(() => {
    function onKey(e) {
      if (menu || done || !q) return;
      if (e.target.closest('input, textarea, select')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.answers.length && !result) {
        setPicked((prevPicked) => ({ ...prevPicked, [q.id]: q.answers[n - 1].id }));
      } else if (e.key === 'Enter') {
        if (result) next();
        else submit();
      } else if (e.key === 'ArrowRight' && result) next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const style = {
    '--rb-font': `${settings.font}px`,
    '--rb-leading': settings.leading,
  };
  const rootClass = [
    'rb',
    `theme-${settings.theme}`,
    `measure-${settings.width}`,
    hideQuestions ? 'is-focus' : '',
    isMobile ? `is-mobile view-${view}` : '',
  ].join(' ');

  const topBar = (
    <header className="rb-top">
      <div className="rb-top-left">
        <Link to="/app/tests" className="rb-logo" aria-label={t('reading.exit')}>
          <span className="rb-logo-mark">О</span>
          <span className="rb-logo-text">ORT.KG</span>
        </Link>
        <span className="rb-top-sep" aria-hidden="true" />
        <span className="rb-top-section">{t('reading.section')}</span>
      </div>
      {passage && !done && (
        <div className="rb-top-mid">
          <span className="rb-chip">{t('reading.textOf', { n: pIdx + 1, total: passages.length })}</span>
          <span className="rb-chip strong">{t('reading.questionOf', { n: qIdx + 1, total: questions.length })}</span>
        </div>
      )}
      <div className="rb-top-right">
        <span className="rb-timer"><Svg d={ICONS.clock} size={16} />{formatClock((now - startedAt.current) / 1000)}</span>
        <button type="button" className="rb-aa" onClick={() => setMenu(true)} aria-label={t('reading.settings')}>
          <span>A</span><span>a</span>
        </button>
        <Link to="/app/tests" className="rb-icon rb-exit" aria-label={t('reading.exit')}><Svg d={ICONS.close} /></Link>
      </div>
      <div className="rb-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
    </header>
  );

  if (!data || !passage || done) {
    const totalOk = Object.values(results).filter((r) => r.correct).length;
    return (
      <div className={rootClass} style={style}>
        {topBar}
        <main className="rb-stage">
          <div className="rb-sheet">
            {error && <p className="rb-error">{error}</p>}
            {!error && !data && <p className="rb-loading"><span className="rb-spinner" />{t('reading.loading')}</p>}
            {data && !passages.length && (
              <>
                <div className="rb-orn" aria-hidden="true"><span /><i>❦</i><span /></div>
                <p className="rb-empty">{t('reading.empty')}</p>
                <Link to="/app/tests" className="rb-btn primary">{t('reading.toList')}</Link>
              </>
            )}
            {done && (
              <>
                <span className="rb-kicker">{t('reading.section')}</span>
                <h1 className="rb-title">{t('reading.doneTitle')}</h1>
                <p className="rb-sub">{t('reading.doneLead', { ok: totalOk, total: answeredCount })}</p>
                <div className="rb-orn" aria-hidden="true"><span /><i>❦</i><span /></div>
                <ul className="rb-summary">
                  {passages.map((p, i) => {
                    const ok = p.questions.filter((item) => results[item.id]?.correct).length;
                    return (
                      <li key={p.id}>
                        <span>{t('reading.doneText', { n: i + 1, ok, total: p.questions.length })}</span>
                        <b>{p.title}</b>
                      </li>
                    );
                  })}
                </ul>
                <div className="rb-actions-row">
                  <button type="button" className="rb-btn ghost" onClick={restart}>{t('reading.again')}</button>
                  <Link to="/app/tests" className="rb-btn primary">{t('reading.toList')}</Link>
                </div>
              </>
            )}
          </div>
        </main>
        {menu && <SettingsPanel settings={settings} update={update} onClose={() => setMenu(false)} t={t} />}
      </div>
    );
  }

  const correctLetter = result
    ? LETTERS[q.answers.findIndex((a) => a.id === result.correctAnswerId)] || ''
    : '';
  const primary = result ? (
    <button type="button" className="rb-btn primary" onClick={next}>
      {isLastQuestion ? (isLastPassage ? t('reading.finish') : t('reading.nextText')) : t('reading.next')}
      <Svg d={ICONS.right} size={16} />
    </button>
  ) : (
    <button type="button" className="rb-btn primary" disabled={!picked[q.id] || busy} onClick={submit}>
      {t('reading.answer')}
    </button>
  );

  return (
    <div className={rootClass} style={style}>
      {topBar}
      <main className="rb-stage">
        <div className="rb-book">
          <article
            className={`rb-page rb-left${flip === 'to-text' ? ' anim-in-back' : ''}`}
            onAnimationEnd={() => setFlip('')}
          >
            <div className={`rb-turn-${turn}`} key={passage.id}>
              <PassageText
                passage={passage}
                number={pIdx + 1}
                pageNo={pIdx * 2 + 1}
                ranges={ranges}
                markRef={markRef}
                t={t}
              />
            </div>
          </article>

          {!hideQuestions && (
            <section
              className={`rb-page rb-right${flip === 'to-question' ? ' anim-in-fwd' : ''}`}
              onAnimationEnd={() => setFlip('')}
            >
              <div className="rb-ribbon" aria-hidden="true"><span>{qIdx + 1}</span></div>
              {isMobile && (
                <button type="button" className="rb-back-link" onClick={() => switchView('text')}>
                  <Svg d={ICONS.left} size={16} />{t('reading.toText')}
                </button>
              )}
              <div className={`rb-q rb-turn-${turn}`} key={q.id}>
                <div className="rb-runhead">
                  <span>{t('reading.textShort', { n: String(pIdx + 1).padStart(2, '0') })} · {passage.title}</span>
                  <span>{pIdx * 2 + 2}</span>
                </div>
                <span className="rb-kicker">{t('reading.question', { n: qIdx + 1 })}</span>
                <QuestionDots questions={questions} current={qIdx} results={results} onPick={(i) => goTo(pIdx, i, i > qIdx ? 'fwd' : 'back')} />
                <h2 className="rb-qtext">{q.text}</h2>
                {q.imageUrl && <img className="rb-qimg" src={q.imageUrl} alt="" />}

                <div className="rb-opts" role="radiogroup">
                  {q.answers.map((a, i) => {
                    const chosen = (result ? result.answerId : picked[q.id]) === a.id;
                    const isRight = result && a.id === result.correctAnswerId;
                    const isWrong = result && chosen && !isRight;
                    const cls = [
                      'rb-opt',
                      chosen ? 'is-chosen' : '',
                      isRight ? 'is-right' : '',
                      isWrong ? 'is-wrong' : '',
                      result && !isRight && !isWrong ? 'is-dim' : '',
                    ].join(' ');
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        className={cls}
                        disabled={Boolean(result)}
                        onClick={() => setPicked((prevPicked) => ({ ...prevPicked, [q.id]: a.id }))}
                      >
                        <span className="rb-radio" aria-hidden="true">
                          {isRight && <Svg d={ICONS.check} size={14} />}
                          {isWrong && <Svg d={ICONS.cross} size={14} />}
                        </span>
                        <span className="rb-letter">{LETTERS[i]}</span>
                        <span className="rb-opt-text">
                          {a.text}
                          {a.imageUrl && <img src={a.imageUrl} alt="" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {result && (
                  <div className="rb-feedback">
                    <p className={`rb-verdict ${result.correct ? 'ok' : 'bad'}`}>
                      <Svg d={result.correct ? ICONS.check : ICONS.cross} size={16} />
                      <b>{result.correct ? t('reading.correct') : t('reading.wrong')}</b>
                      {!result.correct && correctLetter && <span>{t('reading.rightIs', { letter: correctLetter })}</span>}
                    </p>
                    <div className="rb-why">
                      <h3>{t('reading.why')}</h3>
                      <p>{result.explanation || t('reading.noWhy')}</p>
                      {result.explanationImageUrl && <img src={result.explanationImageUrl} alt="" />}
                    </div>
                    {result.evidence && (
                      <div className="rb-proof">
                        <h3><Svg d={ICONS.marker} size={15} />{t('reading.evidence')}</h3>
                        <blockquote>«{result.evidence}»</blockquote>
                        <button type="button" className={`rb-btn soft${showEvidence && !isMobile ? ' on' : ''}`} onClick={toggleEvidence}>
                          <Svg d={ICONS.eye} size={16} />
                          {showEvidence && !isMobile ? t('reading.hideInText') : t('reading.showInText')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <footer className="rb-actions">
                <button type="button" className="rb-btn ghost" onClick={prev} disabled={pIdx === 0 && qIdx === 0}>
                  <Svg d={ICONS.left} size={16} />{t('reading.back')}
                </button>
                {primary}
              </footer>
            </section>
          )}
        </div>

        {hideQuestions && (
          <button type="button" className="rb-focus-exit" onClick={() => update({ focus: false })}>
            <Svg d={ICONS.book} size={16} />{t('reading.showQuestion')}
            <span>{t('reading.questionOf', { n: qIdx + 1, total: questions.length })}</span>
          </button>
        )}
      </main>

      {isMobile && view === 'text' && !hideQuestions && (
        <div className="rb-bottom">
          <div className="rb-bottom-info">
            <b>{t('reading.questionOf', { n: qIdx + 1, total: questions.length })}</b>
            <span className="rb-mini-dots" aria-hidden="true">
              {questions.map((item, i) => (
                <i key={item.id} className={`${i === qIdx ? 'on' : ''} ${results[item.id] ? (results[item.id].correct ? 'ok' : 'bad') : ''}`} />
              ))}
            </span>
          </div>
          <button type="button" className="rb-btn primary" onClick={() => switchView('question')}>
            {t('reading.openQuestion')}<Svg d={ICONS.right} size={16} />
          </button>
        </div>
      )}

      {menu && <SettingsPanel settings={settings} update={update} onClose={() => setMenu(false)} t={t} />}
    </div>
  );
}

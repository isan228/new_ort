import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import '../styles/exam-uworld.css';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
function IconResults() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M8 17v-6M12 17V8M16 17v-4M20 17V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconEnd() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" /><rect x="8.2" y="8.2" width="7.6" height="7.6" rx="1" fill="#fff" /></svg>;
}

function readResult() {
  try { return JSON.parse(sessionStorage.getItem('ortResult') || 'null'); } catch { return null; }
}

export default function TestReview({ onlyWrong = false } = {}) {
  const { t } = useLang();
  const [params] = useSearchParams();
  const wrongOnly = onlyWrong || params.get('wrong') === '1';
  const result = useMemo(() => readResult(), []);
  const items = useMemo(() => {
    const all = result?.items || [];
    return wrongOnly ? all.filter((row) => !row.correct) : all;
  }, [result, wrongOnly]);
  const [index, setIndex] = useState(0);
  const [qnavOpen, setQnavOpen] = useState(true);

  useEffect(() => {
    document.body.classList.add('uworld-review-page', 'usmle-test-session');
    return () => document.body.classList.remove('uworld-review-page', 'usmle-test-session');
  }, []);

  useEffect(() => { setIndex(0); }, [wrongOnly]);

  if (!result) {
    return (
      <div className="ort-exam-empty">
        <p>{t('results.none')} <Link to="/app/tests">{t('results.go')}</Link>.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="ort-exam-empty">
        <p>{wrongOnly ? t('errors.empty') : t('results.none')}</p>
        <div style={{ marginTop: 12 }}>
          <Link className="btn" to="/app/tests">{t('errors.start')}</Link>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(index, items.length - 1);
  const item = items[safeIndex];
  const answers = item?.question?.answers || [];
  const correct = answers.find((a) => a.isCorrect);
  const user = answers.find((a) => a.id === item.answerId);
  const omitted = !item.answerId;
  const statusClass = omitted ? 'is-omit' : (item.correct ? 'is-ok' : 'is-bad');
  const statusText = omitted ? t('review.omitted') : (item.correct ? t('review.correct') : t('review.incorrect'));
  const correctLetter = correct ? LETTERS[answers.indexOf(correct)] : '—';
  const userLetter = user ? LETTERS[answers.indexOf(user)] : '—';

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  return (
    <div className="ort-exam-root ort-review-root">
      <header className="uworld-session-topbar">
        <div className="uworld-tb-left">
          <button
            type="button"
            className={`uworld-tb-icon-btn ${qnavOpen ? 'is-active' : ''}`}
            onClick={() => setQnavOpen((v) => !v)}
          >
            <IconMenu />
          </button>
          <div className="uworld-tb-item-info">
            <span className="uworld-tb-item-label">{t('runner.item', { a: safeIndex + 1, b: items.length })}</span>
            <span className="uworld-tb-qid">{t('runner.qid', { id: item.questionId })}</span>
          </div>
        </div>
        <div className="uworld-tb-tools">
          <button type="button" className="uworld-tb-tool" onClick={toggleFullscreen}>
            <IconFull />
            <span className="uworld-tb-tool-full">{t('runner.fullscreen')}</span>
            <span className="uworld-tb-tool-short">{t('runner.fullscreen')}</span>
          </button>
          <Link className="uworld-tb-tool" to="/app/results">
            <IconResults />
            <span>{t('review.results')}</span>
          </Link>
        </div>
        <div className="uworld-tb-nav">
          <button type="button" className="uworld-tb-nav-btn" disabled={safeIndex <= 0} onClick={() => setIndex((n) => n - 1)}>
            <IconPrev />
            <span>{t('runner.prev')}</span>
          </button>
          <button type="button" className="uworld-tb-nav-btn" disabled={safeIndex >= items.length - 1} onClick={() => setIndex((n) => n + 1)}>
            <IconNext />
            <span>{t('runner.next')}</span>
          </button>
          <Link className="uworld-tb-nav-btn uworld-tb-end" to="/app/tests">{t('review.end')}</Link>
        </div>
      </header>

      <div className={`uworld-review-shell${qnavOpen ? '' : ' qnav-collapsed'}`}>
        <aside className="usmle-qnav uworld-review-qnav">
          <div className="usmle-qnav-title">{t('runner.items')}</div>
          <ol className="usmle-qnav-list">
            {items.map((row, i) => {
              const parts = ['usmle-qnav-item'];
              if (i === safeIndex) parts.push('is-active');
              if (row.correct) parts.push('is-answered', 'is-reviewed');
              else if (row.correct === false) parts.push('is-answered');
              return (
                <li key={row.questionId} className={parts.join(' ')}>
                  <button type="button" className="usmle-qnav-btn" onClick={() => setIndex(i)}>
                    <i className="usmle-qnav-dot" />
                    <span className="usmle-qnav-num">{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="uworld-review-split">
          <section className="uworld-review-pane uworld-review-left">
            <div className="uworld-review-stem">{item.question?.text}</div>
            <div className="uworld-review-choices">
              {answers.map((a, i) => {
                const ok = !!a.isCorrect;
                const isUser = item.answerId === a.id;
                let cls = 'uworld-review-choice';
                if (ok) cls += ' is-correct';
                if (isUser && !ok) cls += ' is-user-wrong';
                if (isUser && ok) cls += ' is-user-correct';
                return (
                  <div key={a.id} className={cls}>
                    <span className="uworld-review-choice-mark">{ok ? '✓' : (isUser ? '✗' : '')}</span>
                    <span className="uworld-review-choice-letter">{LETTERS[i]}.</span>
                    <span className="uworld-review-choice-text">{a.text}</span>
                  </div>
                );
              })}
            </div>
            <div className={`uworld-review-resultbar ${statusClass}`}>
              <div className="uworld-review-resultbar-row">
                <span className="uworld-review-status">{statusText}</span>
                <span className="uworld-review-correct-ans">
                  {t('review.correctAnswer')}: <strong>{correctLetter}</strong>
                </span>
              </div>
              <div className="uworld-review-resultbar-meta">
                {!omitted && (
                  <span>{t('review.yourAnswer')}: <strong>{userLetter}</strong>{user?.text ? ` — ${user.text}` : ''}</span>
                )}
                {omitted && <span>{t('review.noAnswer')}</span>}
              </div>
            </div>
          </section>
          <section className="uworld-review-pane uworld-review-right">
            <div className="uworld-review-expl-head">{t('review.explanation')}</div>
            <div className="uworld-review-expl-body">
              {item.question?.explanation
                ? item.question.explanation
                : <p className="uworld-review-no-expl">{t('review.noExpl')}</p>}
            </div>
          </section>
        </div>
      </div>

      <footer className="uworld-session-footer">
        <div className="uworld-sf-left">
          <div className="uworld-sf-meta">
            <span className="uworld-sf-k">{t('review.mode')}</span>
            <span className="uworld-sf-v">{result.bank || t('results.session')}</span>
          </div>
          <div className="uworld-sf-meta">
            <span className="uworld-sf-k uworld-sf-k-full">{wrongOnly ? t('review.errorsOnly') : t('review.all')}</span>
            <span className="uworld-sf-k uworld-sf-k-short">{t('review.mode')}</span>
            <span className="uworld-sf-v">{safeIndex + 1}/{items.length}</span>
          </div>
        </div>
        <div className="uworld-sf-tools">
          <Link className="uworld-sf-tool" to="/app/results">{t('review.results')}</Link>
          <Link className="uworld-sf-tool uworld-sf-end" to="/app/tests">
            <IconEnd />
            <span className="uworld-sf-tool-full">{t('review.end')}</span>
            <span className="uworld-sf-tool-short">{t('review.end')}</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import '../styles/exam-uworld.css';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function Errors() {
  const { t } = useLang();
  const result = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('ortResult') || 'null'); } catch { return null; }
  }, []);
  const wrong = (result?.items || []).filter((i) => !i.correct);
  const [index, setIndex] = useState(0);
  const item = wrong[Math.min(index, Math.max(0, wrong.length - 1))];
  const answers = item?.question?.answers || [];

  return (
    <div>
      <h1>{t('errors.title')}</h1>
      <p className="muted">{t('errors.lead')}</p>
      {!wrong.length && (
        <div className="empty">
          {t('errors.empty')}
          <div style={{ marginTop: 12 }}><Link className="btn" to="/app/tests">{t('errors.start')}</Link></div>
        </div>
      )}
      {!!wrong.length && item && (
        <>
          <div className="card review-lab" style={{ padding: 0, marginBottom: 16 }}>
            <header className="uworld-session-topbar">
              <div className="uworld-tb-left">
                <div className="uworld-tb-item-info">
                  <span className="uworld-tb-item-label">{t('runner.item', { a: index + 1, b: wrong.length })}</span>
                </div>
              </div>
              <div className="uworld-tb-nav">
                <button type="button" className="uworld-tb-nav-btn" disabled={index <= 0} onClick={() => setIndex((n) => n - 1)}>
                  <span>{t('runner.prev')}</span>
                </button>
                <button type="button" className="uworld-tb-nav-btn" disabled={index >= wrong.length - 1} onClick={() => setIndex((n) => n + 1)}>
                  <span>{t('runner.next')}</span>
                </button>
              </div>
            </header>
            <div className="test-session-layout has-usmle-qnav">
              <aside className="usmle-qnav">
                <ol className="usmle-qnav-list">
                  {wrong.map((row, i) => (
                    <li key={row.questionId} className={`usmle-qnav-item ${i === index ? 'is-active' : ''} is-favorite`}>
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
                  {item.question?.explanation && <p className="muted" style={{ marginTop: 14 }}>{item.question.explanation}</p>}
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <Link className="btn sm" to="/app/create">{t('errors.again')}</Link>
            <Link className="btn ghost sm" to="/app/flashcards">{t('errors.toCards')}</Link>
            <Link className="btn ghost sm" to="/app/tests">{t('errors.similar')}</Link>
          </div>
        </>
      )}
    </div>
  );
}

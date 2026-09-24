import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';

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
          <div className="card review-lab" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div className="exam-top">
              <div className="exam-meta">
                <b>{t('runner.item', { a: index + 1, b: wrong.length })}</b>
                <span>{t('runner.qid', { id: item.questionId })}</span>
              </div>
              <div className="exam-nav">
                <button type="button" className="exam-nav-btn" disabled={index <= 0} onClick={() => setIndex((n) => n - 1)}>
                  ‹ {t('runner.prev')}
                </button>
                <button type="button" className="exam-nav-btn" disabled={index >= wrong.length - 1} onClick={() => setIndex((n) => n + 1)}>
                  {t('runner.next')} ›
                </button>
              </div>
            </div>
            <div className="exam-body">
              <aside className="exam-side">
                {wrong.map((row, i) => (
                  <button
                    key={row.questionId}
                    type="button"
                    className={`exam-num ${i === index ? 'on' : ''} flag`}
                    onClick={() => setIndex(i)}
                  >
                    <em>{i + 1}</em>
                    <i className="exam-dot" />
                  </button>
                ))}
              </aside>
              <main className="exam-main">
                <div className="exam-content">
                  <p className="exam-stem">{item.question?.text}</p>
                  <div className="exam-opts">
                    {answers.map((a, i) => {
                      let cls = 'exam-opt';
                      if (a.isCorrect) cls += ' good';
                      else if (item.answerId === a.id) cls += ' bad';
                      if (item.answerId === a.id || a.isCorrect) cls += ' on';
                      return (
                        <div key={a.id} className={cls}>
                          <i className="exam-radio" />
                          <span><b>({LETTERS[i]})</b> {a.text}</span>
                        </div>
                      );
                    })}
                  </div>
                  {item.question?.explanation && <p className="muted" style={{ marginTop: 14 }}>{item.question.explanation}</p>}
                </div>
              </main>
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

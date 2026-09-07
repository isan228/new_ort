import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';

export default function Errors() {
  const { t } = useLang();
  const result = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('ortResult') || 'null'); } catch { return null; }
  }, []);
  const wrong = (result?.items || []).filter((i) => !i.correct);

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
      {wrong.map((item) => (
        <div key={item.questionId} className="card" style={{ marginBottom: 12 }}>
          <p className="muted">{t('errors.diff')}</p>
          <p className="q-text" style={{ fontSize: 18 }}>{item.question?.text}</p>
          <p className="muted">{t('errors.yours', { a: (item.question?.answers || []).find((a) => a.id === item.answerId)?.text || t('errors.skip') })}</p>
          <p>{t('errors.right', { a: (item.question?.answers || []).find((a) => a.isCorrect)?.text })}</p>
          {item.question?.explanation && <p className="muted">{item.question.explanation}</p>}
          <div className="row">
            <Link className="btn sm" to="/app/create">{t('errors.again')}</Link>
            <Link className="btn ghost sm" to="/app/flashcards">{t('errors.toCards')}</Link>
            <Link className="btn ghost sm" to="/app/tests">{t('errors.similar')}</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

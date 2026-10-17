import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { simApi } from '../../api/client';
import { isOrtGate } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { Difficulty } from './simShared';
import { AttemptRow } from './SimHome';
import '../../styles/sim.css';

export default function SimVariant() {
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const { variantId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    simApi.variant(variantId)
      .then(setData)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
  }, [variantId, navigate]);

  async function start() {
    if (starting) return;
    setStarting(true);
    setError('');
    try {
      const { attemptId } = await simApi.start(variantId);
      navigate(`/app/sim/attempt/${attemptId}`);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  }

  if (!data) return <p className="muted">{error || t('common.loading')}</p>;
  const { subject, variant, activeAttemptId, canStart, attempts } = data;

  return (
    <div className="sim-page exam-brief">
      <Link className="muted" to={`/app/sim/test/${subject.id}`}>← {subject.name}</Link>
      <h1 style={{ marginTop: 10 }}>
        {t('simulation.variantN', { n: variant.number })}
        {' '}
        <Difficulty t={t} value={variant.difficulty} />
      </h1>
      <p className="muted">
        {subject.name}
        {' · '}
        {t('simulation.qCount', { n: variant.questionCount })}
        {' · '}
        {t('simulation.minutes', { n: variant.minutes })}
      </p>

      <div className="card table-scroll">
        <table className="table sim-brief-table">
          <thead>
            <tr>
              <th>№</th>
              <th>{t('simulation.colBlock')}</th>
              <th>{t('simulation.colQuestions')}</th>
              <th>{t('simulation.colTime')}</th>
            </tr>
          </thead>
          <tbody>
            {variant.blocks.map((block, i) => (
              <tr key={block.title + i}>
                <td>{i + 1}</td>
                <td>
                  <b>{block.title}</b>
                  {block.parts.length > 1 && (
                    <div className="muted sim-brief-parts">
                      {block.parts.map((p) => `${p.name} — ${p.count}`).join(' · ')}
                      <br />
                      {t('simulation.sharedTimer')}
                    </div>
                  )}
                </td>
                <td>{block.count}</td>
                <td>{t('simulation.minutes', { n: block.minutes })}</td>
              </tr>
            ))}
            <tr>
              <td />
              <td><b>{t('simulation.total')}</b></td>
              <td><b>{variant.questionCount}</b></td>
              <td><b>{t('simulation.minutes', { n: variant.minutes })}</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>{t('simulation.rulesTitle')}</h3>
        <ul className="exam-rules">
          {[1, 2, 3, 4, 5, 6].map((n) => <li key={n}>{t(`simulation.rule${n}`)}</li>)}
        </ul>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {activeAttemptId ? (
          <Link className="btn lg" to={`/app/sim/attempt/${activeAttemptId}`}>{t('simulation.continue')}</Link>
        ) : (
          <button className="btn lg" type="button" disabled={!canStart || starting} onClick={start}>
            {starting ? t('common.loading') : (attempts.length ? t('simulation.retake') : t('simulation.start'))}
          </button>
        )}
        {!canStart && <span className="muted">{t('simulation.noRetake')}</span>}
      </div>

      {attempts.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>{t('simulation.myAttempts')}</h2>
          <div className="admin-list">
            {attempts.map((a) => <AttemptRow key={a.id} attempt={a} t={t} locale={locale} showName={false} />)}
          </div>
        </section>
      )}
    </div>
  );
}

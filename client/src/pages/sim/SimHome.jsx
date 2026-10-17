import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { simApi } from '../../api/client';
import { isOrtGate } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { Difficulty, formatDate } from './simShared';
import '../../styles/sim.css';

function TestButton({ test, t, onOpen }) {
  const ready = test.variants > 0;
  return (
    <button type="button" className={`sim-pick${ready ? '' : ' is-empty'}`} disabled={!ready} onClick={() => onOpen(test)}>
      <b>{test.name}</b>
      <small>{ready ? t('simulation.variantsN', { n: test.variants }) : t('simulation.soon')}</small>
      {test.isExtra && <span className="badge">{t('simulation.extra')}</span>}
    </button>
  );
}

export function AttemptRow({ attempt, t, locale, showName = true }) {
  const m = attempt.meta || {};
  const done = attempt.status === 'finished';
  return (
    <div className="admin-list-item sim-attempt">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4>
          {showName && `${m.subjectName} · `}
          {t('simulation.variantN', { n: m.number })}
          {' '}
          {m.difficulty && <Difficulty t={t} value={m.difficulty} />}
        </h4>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {formatDate(attempt.createdAt, locale)}
          {' · '}
          {done
            ? t('simulation.resultLine', { c: attempt.correct, n: attempt.total, p: attempt.percent })
            : t('simulation.inProgress')}
        </p>
      </div>
      {done
        ? <Link className="btn sm" to={`/app/sim/attempt/${attempt.id}/result`}>{t('simulation.openResult')}</Link>
        : <Link className="btn sm" to={`/app/sim/attempt/${attempt.id}`}>{t('simulation.continue')}</Link>}
    </div>
  );
}

export default function SimHome() {
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    simApi.catalog()
      .then(setCatalog)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
    simApi.history().then((data) => setHistory(data.attempts || [])).catch(() => {});
  }, [navigate]);

  const open = (test) => navigate(`/app/sim/test/${test.id}`);

  return (
    <div className="sim-page">
      <span className="badge brand">{t('simulation.badge')}</span>
      <h1 style={{ marginTop: 8 }}>{t('simulation.title')}</h1>
      <p className="muted">{t('simulation.lead')}</p>
      {error && <p className="err">{error}</p>}
      {!catalog && !error && <p className="muted">{t('common.loading')}</p>}

      {catalog && (
        <>
          <section className="card sim-track">
            <h2>{t('simulation.tracks.main')}</h2>
            <p className="muted">{t('simulation.mainLead')}</p>
            <div className="sim-pick-grid">
              {catalog.main.map((test) => <TestButton key={test.id} test={test} t={t} onOpen={open} />)}
            </div>
          </section>
          <section className="card sim-track">
            <h2>{t('simulation.tracks.subject')}</h2>
            <p className="muted">{t('simulation.subjectLead')}</p>
            <div className="sim-pick-grid">
              {catalog.subject.map((test) => <TestButton key={test.id} test={test} t={t} onOpen={open} />)}
            </div>
            {!catalog.subject.length && <div className="empty">{t('simulation.soon')}</div>}
          </section>
          {catalog.state_lang.length > 0 && (
            <section className="card sim-track">
              <h2>{t('simulation.tracks.state_lang')}</h2>
              <p className="muted">{t('simulation.stateLead')}</p>
              <div className="sim-pick-grid">
                {catalog.state_lang.map((test) => <TestButton key={test.id} test={test} t={t} onOpen={open} />)}
              </div>
            </section>
          )}
        </>
      )}

      {history.length > 0 && (
        <section>
          <h2>{t('simulation.history')}</h2>
          <div className="admin-list">
            {history.map((a) => <AttemptRow key={a.id} attempt={a} t={t} locale={locale} />)}
          </div>
        </section>
      )}
    </div>
  );
}

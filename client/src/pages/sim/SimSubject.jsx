import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { simApi } from '../../api/client';
import { isOrtGate } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { Difficulty, formatDate } from './simShared';
import '../../styles/sim.css';

function statusLine(t, locale, v) {
  if (v.status === 'active') return t('simulation.inProgress');
  if (v.status === 'finished' && v.last) {
    return `${t('simulation.passed')} · ${t('simulation.resultLine', { c: v.last.correct, n: v.last.total, p: v.last.percent })} · ${formatDate(v.last.finishedAt, locale)}`;
  }
  return t('simulation.notStarted');
}

export default function SimSubject() {
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    simApi.subject(subjectId)
      .then(setData)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
  }, [subjectId, navigate]);

  if (!data) return <p className="muted">{error || t('common.loading')}</p>;
  const { subject, variants } = data;

  return (
    <div className="sim-page">
      <Link className="muted" to="/app/sim">← {t('simulation.title')}</Link>
      <h1 style={{ marginTop: 10 }}>{subject.name}</h1>
      {subject.isExtra && <p className="muted">{t('simulation.extraHint')}</p>}
      <p className="muted">{t('simulation.variantsLead')}</p>
      {!variants.length && <div className="empty">{t('simulation.noVariants')}</div>}
      <div className="sim-variants">
        {variants.map((v) => (
          <button key={v.id} type="button" className={`card sim-variant is-${v.status}`} onClick={() => navigate(`/app/sim/variant/${v.id}`)}>
            <span className="sim-variant-num">№{v.number}</span>
            <span className="sim-variant-body">
              <b>{t('simulation.variantN', { n: v.number })}</b>
              <Difficulty t={t} value={v.difficulty} />
              <small className="muted">
                {t('simulation.qCount', { n: v.questionCount })}
                {' · '}
                {t('simulation.minutes', { n: v.minutes })}
              </small>
              <small className={`sim-variant-status is-${v.status}`}>{statusLine(t, locale, v)}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

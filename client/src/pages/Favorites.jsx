import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { practiceApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import MathText from '../components/MathText';
import { FlagButton, useFlags } from './practice/PracticeRunner';
import '../styles/practice.css';

export default function Favorites() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [flags, setFlags, toggleFlag] = useFlags({});

  useEffect(() => {
    practiceApi.flags()
      .then((data) => {
        setList(data.questions || []);
        setFlags(Object.fromEntries((data.questions || []).map((q) => [q.id, true])));
      })
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
  }, [navigate, setFlags]);

  return (
    <div>
      <h1>{t('practice.flaggedTitle')}</h1>
      <p className="muted">{t('practice.flaggedLead')}</p>
      {error && <p className="err">{error}</p>}
      {list && !list.length && (
        <div className="empty">
          {t('practice.flaggedEmpty')}
          <div style={{ marginTop: 12 }}><Link className="btn" to="/app/create">{t('practice.title')}</Link></div>
        </div>
      )}
      {list && list.length > 0 && (
        <>
          <Link className="btn" to="/app/create?filter=flagged">{t('practice.trainFlagged')}</Link>
          <div className="admin-list" style={{ marginTop: 14 }}>
            {list.map((q) => (
              <div key={q.id} className="admin-list-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>{q.kind === 'compare' ? `${q.compareA} ⟷ ${q.compareB}` : <MathText text={q.text} />}</h4>
                  <p className="muted" style={{ margin: '4px 0 0' }}>{q.topic ? `${q.topic.subjectName} · ${q.topic.name}` : ''}</p>
                </div>
                <FlagButton on={!!flags[q.id]} onClick={() => toggleFlag(q.id)} t={t} className="pr-flag-sm" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

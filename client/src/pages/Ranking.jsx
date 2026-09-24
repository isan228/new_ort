import { useEffect, useState } from 'react';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Ranking() {
  const { user } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('week');
  const [data, setData] = useState({ rows: [], me: null });
  const [error, setError] = useState('');

  useEffect(() => {
    authApi.ranking(tab).then(setData).catch((err) => setError(err.message));
  }, [tab]);

  const me = data.me;
  const rows = data.rows || [];

  return (
    <div>
      <h1>{t('ranking.title')}</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <b>{me ? t('ranking.you', { n: me.place }) : t('ranking.youNone')}</b>
        <p className="muted">
          {me ? t('ranking.sub', { score: me.score }) : t('ranking.empty')}
        </p>
      </div>
      <div className="tabs">
        {[['today', t('ranking.today')], ['week', t('ranking.week')], ['month', t('ranking.month')], ['all', t('ranking.all')]].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>#</th><th>{t('ranking.pupil')}</th><th>{t('ranking.score')}</th><th>{t('ranking.progress')}</th><th>{t('home.streak')}</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className={row.userId === user?.id ? 'you' : ''}>
                <td>{row.place <= 3 ? ['🥇', '🥈', '🥉'][row.place - 1] : row.place}</td>
                <td className="row"><span className="avatar">{(row.name || '?')[0]}</span> {row.name}</td>
                <td>{row.score}</td>
                <td><div className="progress"><i style={{ width: `${row.progress}%` }} /></div></td>
                <td>{row.streak} {t('common.days')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="empty">{t('ranking.empty')}</div>}
    </div>
  );
}

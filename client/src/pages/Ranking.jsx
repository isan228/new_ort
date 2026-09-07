import { useState } from 'react';
import { RANKING } from '../lib/progress';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Ranking() {
  const { user } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('week');
  const me = user?.name || t('ranking.youName');

  return (
    <div>
      <h1>{t('ranking.title')}</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <b>{t('ranking.you', { n: 127 })}</b>
        <p className="muted">{t('ranking.sub', { score: 214 })}</p>
      </div>
      <div className="tabs">
        {[['today', t('ranking.today')], ['week', t('ranking.week')], ['month', t('ranking.month')], ['all', t('ranking.all')]].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>#</th><th>{t('ranking.pupil')}</th><th>{t('ranking.score')}</th><th>{t('ranking.progress')}</th><th>{t('home.streak')}</th></tr></thead>
          <tbody>
            {RANKING.map((row) => (
              <tr key={row.place} className={row.name === me ? 'you' : ''}>
                <td>{row.place <= 3 ? ['🥇', '🥈', '🥉'][row.place - 1] : row.place}</td>
                <td className="row"><span className="avatar">{row.name[0]}</span> {row.name}</td>
                <td>{row.score}</td>
                <td><div className="progress"><i style={{ width: `${row.progress}%` }} /></div></td>
                <td>{row.streak} {t('common.days')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { activityDays, loadProgress } from '../lib/progress';
import { useLang } from '../context/LangContext';

export default function Stats() {
  const { t } = useLang();
  const p = loadProgress();
  const days = activityDays();
  const line = [188, 192, 190, 198, 201, 206, 204, 210, 208, 214];

  return (
    <div>
      <h1>{t('stats.title')}</h1>
      <div className="grid-4">
        <div className="card stat"><b>206</b><span className="muted">{t('stats.avg')}</span></div>
        <div className="card stat"><b>218</b><span className="muted">{t('stats.best')}</span></div>
        <div className="card stat"><b>14</b><span className="muted">{t('stats.tests')}</span></div>
        <div className="card stat"><b>1 284</b><span className="muted">{t('stats.questions')}</span></div>
      </div>
      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card stat"><b>81%</b><span className="muted">{t('stats.acc')}</span></div>
        <div className="card stat"><b>37 ч</b><span className="muted">{t('stats.hours')}</span></div>
        <div className="card stat"><b>{p.streak}</b><span className="muted">{t('home.streak')}</span></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('stats.byDay')}</h3>
        <svg viewBox="0 0 320 120" width="100%" height="120">
          <polyline fill="none" stroke="var(--brand)" strokeWidth="3" points={line.map((v, i) => `${i * 35},${110 - (v - 180) * 2}`).join(' ')} />
        </svg>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('stats.byTopic')}</h3>
          <div className="bar-row"><span>{t('stats.grammar')}</span><div className="progress"><i style={{ width: '91%' }} /></div><b>91%</b></div>
          <div className="bar-row"><span>{t('stats.math')}</span><div className="progress"><i style={{ width: '68%' }} /></div><b>68%</b></div>
          <div className="bar-row"><span>{t('stats.reading')}</span><div className="progress"><i style={{ width: '74%' }} /></div><b>74%</b></div>
          <div className="bar-row"><span>{t('stats.analogies')}</span><div className="progress"><i style={{ width: '61%' }} /></div><b>61%</b></div>
        </div>
        <div className="card">
          <h3>{t('stats.activity')}</h3>
          <div className="heat">{days.map((d) => <i key={d.key} className={d.level ? `l${d.level}` : ''} />)}</div>
          <h3 style={{ marginTop: 16 }}>{t('stats.weak')}</h3>
          <ol>
            <li>{t('stats.analogies')} — 61%</li>
            <li>{t('stats.math')} — 68%</li>
            <li>{t('stats.reading')} — 74%</li>
          </ol>
          <Link className="btn" to="/app/errors">{t('stats.improve')}</Link>
        </div>
      </div>
    </div>
  );
}

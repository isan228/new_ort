import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { activityDays, loadProgress } from '../lib/progress';

export default function Home() {
  const { user } = useAuth();
  const { t } = useLang();
  const p = loadProgress();
  const left = Math.max(0, p.dailyGoal - p.todayQuestions);
  const pct = Math.round((p.todayQuestions / p.dailyGoal) * 100);
  const days = activityDays();
  const first = (user?.name || t('home.friend')).split(' ')[0];

  return (
    <div>
      <h1>{t('home.hello', { name: first })}</h1>
      <p className="muted">{t('home.goal', { score: p.goalScore })}</p>

      <div className="grid-2">
        <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="circle" style={{ '--p': 78 }}><span>78%</span></div>
            <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>{t('home.progressLabel')}</p>
          </div>
          <div style={{ flex: 1 }}>
            <h2>{t('home.yourProgress')}</h2>
            <p className="muted">{t('home.progressText')}</p>
            <Link className="btn" to="/app/tests">{t('home.continue')}</Link>
          </div>
        </div>
        <div className="card">
          <div className="muted">{t('home.nextTopic')}</div>
          <h2 style={{ fontSize: 32 }}>{t('home.analogies')}</h2>
          <span className="badge">{t('home.accuracy', { n: 61 })}</span>
          <p className="muted" style={{ marginTop: 12 }}>{t('home.nextHint')}</p>
          <Link className="btn" to="/app/tests">{t('home.train')}</Link>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('home.todayGoal')}</h3>
          <b style={{ fontSize: 28 }}>{t('home.questions', { a: p.todayQuestions, b: p.dailyGoal })}</b>
          <div className="progress" style={{ margin: '12px 0' }}><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
          <p className="muted">{t('home.math20')}</p>
          <p className="muted">{t('home.an10')}</p>
          <p className="muted">{t('home.read10')}</p>
          <Link className="btn" to="/app/tests">{t('home.continue')}</Link>
        </div>
        <div className="card">
          <h3>{t('home.streak')}</h3>
          <b style={{ fontSize: 28 }}>{t('home.streakDays', { n: p.streak })}</b>
          <p className="muted">{t('home.streakLeft', { n: left })}</p>
          <div className="heat" style={{ marginTop: 12 }}>
            {days.map((d) => <i key={d.key} className={d.level ? `l${d.level}` : ''} title={d.label} />)}
          </div>
        </div>
        <div className="card">
          <h3>{t('home.weak')}</h3>
          <div className="bar-row"><span>{t('home.analogies')}</span><div className="progress"><i style={{ width: '61%' }} /></div><b>61%</b></div>
          <div className="bar-row"><span>{t('home.math')}</span><div className="progress"><i style={{ width: '68%' }} /></div><b>68%</b></div>
          <div className="bar-row"><span>{t('home.reading')}</span><div className="progress"><i style={{ width: '74%' }} /></div><b>74%</b></div>
          <Link className="btn ghost" to="/app/errors">{t('home.repeatErrors')}</Link>
        </div>
      </div>
    </div>
  );
}

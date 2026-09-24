import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

const TOPIC_KEYS = {
  verbal: 'home.analogies',
  grammar: 'results.grammar',
  math: 'home.math',
  subject: 'tests.subject',
};

export default function Home() {
  const { user } = useAuth();
  const { t } = useLang();
  const [stats, setStats] = useState(null);
  const first = (user?.name || t('home.friend')).split(' ')[0];
  const accuracy = stats?.accuracy || 0;
  const today = stats?.todayQuestions || 0;
  const goal = stats?.dailyGoal || 40;
  const left = Math.max(0, goal - today);
  const pct = Math.round((today / goal) * 100);
  const weak = stats?.weak?.[0];
  const weakKey = weak ? (TOPIC_KEYS[weak.key] || 'home.analogies') : 'home.analogies';

  useEffect(() => {
    authApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div>
      <h1>{t('home.hello', { name: first })}</h1>
      <p className="muted">{t('home.goal', { score: 220 })}</p>

      <div className="grid-2">
        <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="circle" style={{ '--p': accuracy }}><span>{accuracy}%</span></div>
            <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>{t('home.progressLabel')}</p>
          </div>
          <div style={{ flex: 1 }}>
            <h2>{t('home.yourProgress')}</h2>
            <p className="muted">{stats?.tests ? t('home.progressReal', { n: stats.tests, q: stats.questions }) : t('home.progressEmpty')}</p>
            <Link className="btn" to="/app/tests">{t('home.continue')}</Link>
          </div>
        </div>
        <div className="card">
          <div className="muted">{t('home.nextTopic')}</div>
          <h2 style={{ fontSize: 32 }}>{t(weakKey)}</h2>
          <span className="badge">{t('home.accuracy', { n: weak?.accuracy || 0 })}</span>
          <p className="muted" style={{ marginTop: 12 }}>{weak ? t('home.nextHint') : t('home.progressEmpty')}</p>
          <Link className="btn" to="/app/tests">{t('home.train')}</Link>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('home.todayGoal')}</h3>
          <b style={{ fontSize: 28 }}>{t('home.questions', { a: today, b: goal })}</b>
          <div className="progress" style={{ margin: '12px 0' }}><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
          <Link className="btn" to="/app/tests">{t('home.continue')}</Link>
        </div>
        <div className="card">
          <h3>{t('home.streak')}</h3>
          <b style={{ fontSize: 28 }}>{t('home.streakDays', { n: stats?.streak || 0 })}</b>
          <p className="muted">{t('home.streakLeft', { n: left })}</p>
          <div className="heat" style={{ marginTop: 12 }}>
            {(stats?.activity || []).map((d) => <i key={d.key} className={d.level ? `l${d.level}` : ''} title={d.label} />)}
          </div>
        </div>
        <div className="card">
          <h3>{t('home.weak')}</h3>
          {(stats?.weak || []).length
            ? stats.weak.map((row) => (
              <div className="bar-row" key={row.key}>
                <span>{t(TOPIC_KEYS[row.key] || 'home.analogies')}</span>
                <div className="progress"><i style={{ width: `${row.accuracy}%` }} /></div>
                <b>{row.accuracy}%</b>
              </div>
            ))
            : <p className="muted">{t('home.progressEmpty')}</p>}
          <Link className="btn ghost" to="/app/errors">{t('home.repeatErrors')}</Link>
        </div>
      </div>
    </div>
  );
}

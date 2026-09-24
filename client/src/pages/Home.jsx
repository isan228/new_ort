import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

function formatOrt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(value).replace('.', ',');
}

function ScoreRow({ title, points, max, factor, hint }) {
  const pct = max && points != null ? Math.min(100, (Number(points) / max) * 100) : 0;
  return (
    <div className="home-score-row">
      <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
        <span>{title}</span>
        <b>{points == null ? '—' : `${formatOrt(points)} / ${max}`}</b>
      </div>
      <div className="progress"><i style={{ width: `${pct}%` }} /></div>
      {hint && <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{hint}</p>}
      {factor && !hint && <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>× {formatOrt(factor)}</p>}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useLang();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    authApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const first = (user?.name || t('home.friend')).split(' ')[0];
  const ort = stats?.ort;
  const main = ort?.main;
  const subjects = ort?.subjects || [];
  const today = stats?.todayQuestions || 0;
  const goal = stats?.dailyGoal || 40;

  return (
    <div>
      <h1>{t('home.hello', { name: first })}</h1>
      <p className="muted">{t('home.scoreLead')}</p>

      <div className="grid-2" style={{ marginTop: 8 }}>
        <div className="card home-score-card">
          <div className="muted">{t('home.mainTitle')}</div>
          <div className="home-score-hero">
            {formatOrt(main?.total)}
            <span> / {main?.maxScore || 245}</span>
          </div>
          <p className="muted">{main?.fromExam ? t('home.fromSim') : t('home.fromPractice')}</p>
          <ScoreRow
            title={t('home.verbal')}
            points={main?.verbal?.attempted === false ? null : main?.verbal?.points}
            max={main?.verbal?.maxScore || 121}
            factor={2}
            hint={t('home.verbalHint')}
          />
          <ScoreRow
            title={t('home.grammarBlock')}
            points={main?.grammar?.attempted === false ? null : main?.grammar?.points}
            max={main?.grammar?.maxScore || 57}
            factor={1.9}
            hint={t('home.grammarHint')}
          />
          <ScoreRow
            title={t('home.mathBlock')}
            points={main?.math?.attempted === false ? null : main?.math?.points}
            max={main?.math?.maxScore || 67}
            factor={1.12}
            hint={t('home.mathHint')}
          />
          <Link className="btn" to="/app/exam" style={{ marginTop: 12 }}>{t('sim.open')}</Link>
        </div>

        <div className="card home-score-card">
          <div className="muted">{t('home.subjectTitle')}</div>
          <p className="muted">{t('home.subjectHint')}</p>
          {subjects.length
            ? subjects.map((row) => (
              <ScoreRow
                key={row.id}
                title={row.name}
                points={row.attempted ? row.officialScore : null}
                max={row.maxScore || 150}
                hint={t('home.subjectFactor')}
              />
            ))
            : <p className="muted">{t('home.noSubjects')}</p>}
          <Link className="btn ghost" to="/app/tests" style={{ marginTop: 12 }}>{t('home.continue')}</Link>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('home.todayGoal')}</h3>
          <b style={{ fontSize: 28 }}>{t('home.questions', { a: today, b: goal })}</b>
          <div className="progress" style={{ margin: '12px 0' }}>
            <i style={{ width: `${Math.min(100, Math.round((today / goal) * 100))}%` }} />
          </div>
          <Link className="btn" to="/app/tests">{t('home.continue')}</Link>
        </div>
        <div className="card">
          <h3>{t('home.streak')}</h3>
          <b style={{ fontSize: 28 }}>{t('home.streakDays', { n: stats?.streak || 0 })}</b>
          <div className="heat" style={{ marginTop: 12 }}>
            {(stats?.activity || []).map((d) => <i key={d.key} className={d.level ? `l${d.level}` : ''} title={d.label} />)}
          </div>
        </div>
        <div className="card">
          <h3>{t('home.best')}</h3>
          <b style={{ fontSize: 28 }}>{formatOrt(stats?.bestOfficial || main?.total)} / 245</b>
          <p className="muted">{t('home.bestHint')}</p>
          <Link className="btn ghost" to="/app/stats">{t('nav.stats')}</Link>
        </div>
      </div>
    </div>
  );
}

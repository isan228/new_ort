import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import { useLang } from '../context/LangContext';

const TOPIC_KEYS = {
  verbal: 'stats.analogies',
  grammar: 'stats.grammar',
  math: 'stats.math',
  subject: 'tests.subject',
};

function formatOrt(value) {
  if (value == null || Number.isNaN(Number(value))) return '0';
  return String(value).replace('.', ',');
}

function BellCurve({ curve, t }) {
  if (!curve?.points?.length) return <p className="muted">{t('stats.empty')}</p>;
  const w = 640;
  const h = 180;
  const pad = 16;
  const xs = curve.points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const span = Math.max(1, maxX - minX);
  const toX = (x) => pad + ((x - minX) / span) * (w - pad * 2);
  const toY = (y) => h - 24 - y * (h - 48);
  const d = curve.points.map((p, i) => `${i ? 'L' : 'M'}${toX(p.x)},${toY(p.y)}`).join(' ');
  const userX = curve.userScore == null ? null : toX(curve.userScore);
  const meanX = toX(curve.mean);

  return (
    <svg className="stats-curve" viewBox={`0 0 ${w} ${h}`} width="100%" height="180">
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth="2" />
      <line x1={meanX} y1="12" x2={meanX} y2={h - 20} stroke="var(--line)" strokeDasharray="4 4" />
      {userX != null && (
        <>
          <line x1={userX} y1="12" x2={userX} y2={h - 20} stroke="var(--brand)" />
          <circle cx={userX} cy={toY(1)} r="6" fill="var(--ok)" />
        </>
      )}
    </svg>
  );
}

export default function Stats() {
  const { t, locale } = useLang();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi.stats().then(setStats).catch((err) => setError(err.message));
  }, []);

  function kv(label, value) {
    return (
      <div className="stats-kv-row">
        <span className="muted">{label}</span>
        <b>{value}</b>
      </div>
    );
  }

  return (
    <div className="stats-page">
      <h1>{t('stats.title')}</h1>
      {error && <p className="err">{error}</p>}

      <div className="stats-top">
        <div className="card stats-circles">
          <div>
            <div className="circle sm" style={{ '--p': stats?.accuracy || 0 }}>
              <span>{stats?.accuracy || 0}%</span>
            </div>
            <p className="muted" style={{ textAlign: 'center', margin: '8px 0 0' }}>{t('stats.acc')}</p>
          </div>
          <div>
            <div className="circle sm" style={{ '--p': stats?.usedPct || 0 }}>
              <span>{formatOrt(stats?.usedPct || 0)}%</span>
            </div>
            <p className="muted" style={{ textAlign: 'center', margin: '8px 0 0' }}>{t('stats.usedPct')}</p>
          </div>
        </div>

        <div className="card">
          <h3>{t('stats.yourResult')}</h3>
          {kv(t('stats.correctN'), stats?.correct || 0)}
          {kv(t('stats.wrongN'), stats?.incorrect || 0)}
          {kv(t('stats.skipN'), stats?.skipped || 0)}
          {kv(t('stats.avg'), formatOrt(stats?.avgOfficial || 0))}
          {kv(t('stats.best'), formatOrt(stats?.bestOfficial || 0))}
        </div>

        <div className="card">
          <h3>{t('stats.bankUse')}</h3>
          {kv(t('stats.usedQ'), stats?.used || 0)}
          {kv(t('stats.unusedQ'), stats?.unused || 0)}
          {kv(t('stats.bankTotal'), stats?.bankTotal || 0)}
          {kv(t('stats.hours'), `${stats?.hours || 0} ${t('stats.h')}`)}
          {kv(t('home.streak'), stats?.streak || 0)}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('stats.testCounts')}</h3>
          {kv(t('stats.testsDone'), stats?.tests || 0)}
          {kv(t('stats.mainExams'), stats?.mainExams || 0)}
          {kv(t('stats.practiceTests'), stats?.practiceTests || 0)}
        </div>
        <div className="card">
          <h3>{t('stats.percentileTitle')}</h3>
          <div className="stats-legend">
            <span><i className="dot ok" /> {t('stats.youMark')}: {formatOrt(stats?.curve?.userScore ?? stats?.avgOfficial ?? 0)}</span>
            <span><i className="dot mean" /> {t('stats.median')}: {formatOrt(stats?.curve?.mean || 0)}</span>
          </div>
          {kv(t('stats.percentile'), `${stats?.percentile || 0}%`)}
          {kv(t('stats.place'), stats?.place ? `#${stats.place} / ${stats.peers}` : '—')}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('stats.curveTitle')}</h3>
        <BellCurve curve={stats?.curve} t={t} />
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t('stats.byTopic')}</h3>
          {(stats?.topics || []).length
            ? stats.topics.map((row) => (
              <div className="bar-row" key={row.key}>
                <span>{t(TOPIC_KEYS[row.key] || row.key)}</span>
                <div className="progress"><i style={{ width: `${row.accuracy}%` }} /></div>
                <b>{row.accuracy}%</b>
              </div>
            ))
            : <p className="muted">{t('stats.empty')}</p>}
        </div>
        <div className="card">
          <h3>{t('stats.activity')}</h3>
          <div className="heat">{(stats?.activity || []).map((d) => <i key={d.key} className={d.level ? `l${d.level}` : ''} title={d.label} />)}</div>
          <h3 style={{ marginTop: 16 }}>{t('stats.weak')}</h3>
          {(stats?.weak || []).length ? (
            <ol>
              {stats.weak.map((row) => (
                <li key={row.key}>{t(TOPIC_KEYS[row.key] || row.key)} — {row.accuracy}%</li>
              ))}
            </ol>
          ) : <p className="muted">{t('stats.empty')}</p>}
          <Link className="btn" to="/app/errors">{t('stats.improve')}</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }} id="history">
        <h3>{t('stats.pastTests')}</h3>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t('history.date')}</th>
                <th>{t('history.score')}</th>
                <th>{t('history.acc')}</th>
                <th>{t('stats.kind')}</th>
                <th>{t('stats.time')}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.history || []).map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString(locale)}</td>
                  <td>
                    {row.officialScore != null
                      ? `${formatOrt(row.officialScore)}${row.maxScore ? ` / ${row.maxScore}` : ''}`
                      : `${row.score}/${row.total}`}
                  </td>
                  <td>{row.accuracy}%</td>
                  <td>{row.examType === 'main' ? t('sim.title') : (row.testName || t('results.session'))}</td>
                  <td>{row.durationSec ? t('stats.min', { n: Math.round(row.durationSec / 60) }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!(stats?.history || []).length && <div className="empty">{t('history.empty')}</div>}
      </div>
    </div>
  );
}

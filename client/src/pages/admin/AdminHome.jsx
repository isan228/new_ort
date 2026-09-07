import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

function subLabel(user, t, locale) {
  if (!user.subscriptionEndDate) return t('admin.noSub');
  const date = new Date(user.subscriptionEndDate);
  const active = date > new Date();
  const text = t('admin.activeUntil', { date: date.toLocaleDateString(locale) });
  return active ? text : `${t('admin.expired')} · ${text}`;
}

export default function AdminHome() {
  const { t, locale } = useLang();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const cards = [
    [stats?.users, t('admin.people')],
    [stats?.activeSubs, t('admin.active')],
    [stats?.expired, t('admin.expired')],
    [stats?.paid, t('admin.payments')],
    [stats?.subjects, t('admin.categories')],
    [stats?.tests, t('admin.tests')],
    [stats?.questions, t('admin.questions')],
    [stats?.flashcards, t('admin.cards')],
    [stats?.results, t('admin.results')],
    [stats?.revenue, `${t('admin.revenue')}, ${t('common.som')}`],
  ];

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.dashboard')}</h1>
          <p className="muted">{t('admin.programLead')}</p>
        </div>
        <Link className="btn sm" to="/админ/content">{t('admin.program')}</Link>
      </div>
      {error && <p className="err">{error}</p>}
      <div className="grid-4">
        {cards.map(([value, label]) => (
          <div key={label} className="card stat">
            <b>{value ?? '—'}</b>
            <span className="muted">{label}</span>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 28 }}>{t('admin.recentUsers')}</h3>
      <div className="admin-list">
        {!stats && <p className="empty">{t('common.loading')}</p>}
        {stats && !(stats.recentUsers || []).length && <p className="empty">—</p>}
        {(stats?.recentUsers || []).map((u) => (
          <div key={u.id} className="admin-list-item">
            <div>
              <h4>{u.name}</h4>
              <p className="muted" style={{ margin: 0 }}>{u.login || u.email}</p>
            </div>
            <span className={`badge ${u.subscriptionEndDate && new Date(u.subscriptionEndDate) > new Date() ? 'ok' : ''}`}>
              {subLabel(u, t, locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

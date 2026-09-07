import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

export default function AdminHome() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);
  useEffect(() => { adminApi.stats().then(setStats).catch(() => {}); }, []);
  return (
    <div>
      <h1>{t('admin.dashboard')}</h1>
      <div className="grid-4">
        <div className="card stat"><b>{stats?.users ?? '—'}</b><span className="muted">{t('admin.people')}</span></div>
        <div className="card stat"><b>{stats?.activeSubs ?? '—'}</b><span className="muted">Premium</span></div>
        <div className="card stat"><b>{stats?.questions ?? '—'}</b><span className="muted">{t('admin.questions')}</span></div>
        <div className="card stat"><b>{stats?.paid ?? '—'}</b><span className="muted">{t('admin.payments')}</span></div>
      </div>
      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{stats?.subjects ?? '—'}</b><span className="muted">{t('admin.categories')}</span></div>
        <div className="card stat"><b>{stats?.tests ?? '—'}</b><span className="muted">{t('admin.tests')}</span></div>
        <div className="card stat"><b>{stats?.flashcards ?? '—'}</b><span className="muted">{t('admin.cards')}</span></div>
      </div>
    </div>
  );
}

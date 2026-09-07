import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';

export default function AdminHome() {
  const [stats, setStats] = useState(null);
  useEffect(() => { adminApi.stats().then(setStats).catch(() => {}); }, []);
  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid-4">
        <div className="card stat"><b>{stats?.users ?? '—'}</b><span className="muted">пользователей</span></div>
        <div className="card stat"><b>{stats?.activeSubs ?? '—'}</b><span className="muted">Premium</span></div>
        <div className="card stat"><b>{stats?.questions ?? '—'}</b><span className="muted">вопросов</span></div>
        <div className="card stat"><b>{stats?.paid ?? '—'}</b><span className="muted">оплат</span></div>
      </div>
      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{stats?.subjects ?? '—'}</b><span className="muted">категорий</span></div>
        <div className="card stat"><b>{stats?.tests ?? '—'}</b><span className="muted">тестов</span></div>
        <div className="card stat"><b>{stats?.flashcards ?? '—'}</b><span className="muted">карточек</span></div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

export default function AdminUsers() {
  const { t, locale } = useLang();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  async function load(search = q) {
    try {
      const data = await adminApi.users({ q: search, limit: 100 });
      setUsers(data.users);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load('').catch(() => {}); }, []);

  async function grant(id, months) {
    await adminApi.grant(id, months);
    await load();
  }

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.users')}</h1>
          <p className="muted">{users.length} {t('admin.people')}</p>
        </div>
        <input
          className="admin-search"
          value={q}
          onChange={(e) => {
            const next = e.target.value;
            setQ(next);
            load(next);
          }}
          placeholder={t('admin.userSearch')}
        />
      </div>
      {error && <p className="err">{error}</p>}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.login')}</th>
              <th>Email</th>
              <th>{t('admin.subUntil')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const end = u.subscriptionEndDate ? new Date(u.subscriptionEndDate) : null;
              const active = end && end > new Date();
              return (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.login || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${active ? 'ok' : ''}`}>
                      {end ? end.toLocaleDateString(locale) : t('admin.noSub')}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      {[1, 3, 12].map((m) => (
                        <button key={m} className="btn sm ghost" type="button" onClick={() => grant(u.id, m)}>
                          {t('admin.grantN', { n: m })}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

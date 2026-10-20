import { useEffect, useState } from 'react';
import { telegramAdminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

const STATUSES = ['all', 'open', 'taken', 'cancelled'];

function who(name, username) {
  return `${name || '—'}${username ? ` (@${username})` : ''}`;
}

function humanDate(iso, locale) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function StatusCard({ status, onWebhook, t }) {
  if (!status) return null;
  const ready = status.configured && status.group && !status.bot?.error;
  return (
    <div className={`card tg-status${ready ? ' is-ready' : ''}`}>
      <div className="tg-status-row">
        <span>{t('admin.tg.bot')}</span>
        <b>{!status.configured ? t('admin.tg.noToken') : (status.bot?.error ? status.bot.error : `@${status.bot?.username}`)}</b>
      </div>
      <div className="tg-status-row">
        <span>{t('admin.tg.group')}</span>
        <b>{status.group ? (status.group.title || status.group.id) : t('admin.tg.noGroup')}</b>
      </div>
      {status.configured && (
        <div className="tg-status-row">
          <span>{t('admin.tg.mode')}</span>
          <b>
            {status.polling ? t('admin.tg.polling') : (status.webhook?.url ? t('admin.tg.webhookOn') : t('admin.tg.webhookOff'))}
            {status.webhook?.lastError && <span className="err"> · {status.webhook.lastError}</span>}
          </b>
        </div>
      )}
      {status.configured && !status.polling && (
        <button className="btn ghost sm" type="button" onClick={onWebhook}>{t('admin.tg.reconnect')}</button>
      )}
      {!ready && (
        <ol className="tg-steps">
          <li>{t('admin.tg.step1')}</li>
          <li>{t('admin.tg.step2')}</li>
          <li>{t('admin.tg.step3')}</li>
          <li>{t('admin.tg.step4')}</li>
        </ol>
      )}
    </div>
  );
}

export default function AdminTelegram() {
  const { t, locale } = useLang();
  const [status, setStatus] = useState(null);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function loadRequests(nextFilter = filter, nextQ = q) {
    setData(await telegramAdminApi.requests({ status: nextFilter === 'all' ? '' : nextFilter, q: nextQ }));
  }

  useEffect(() => {
    telegramAdminApi.status().then(setStatus).catch((err) => setError(err.message));
    loadRequests().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn) {
    setError('');
    setMsg('');
    try {
      await fn();
      setMsg(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    }
  }

  const counts = data?.counts || {};
  const total = (counts.open || 0) + (counts.taken || 0) + (counts.cancelled || 0);

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.tg.title')}</h1>
          <p className="muted">{t('admin.tg.lead')}</p>
        </div>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}
      <StatusCard
        status={status}
        t={t}
        onWebhook={() => run(async () => {
          await telegramAdminApi.webhook();
          setStatus(await telegramAdminApi.status());
        })}
      />

      {data?.people?.length > 0 && (
        <div className="card table-scroll" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{t('admin.tg.people')}</h3>
          <table className="table">
            <thead>
              <tr><th>{t('admin.tg.person')}</th><th>{t('admin.tg.taken')}</th><th>{t('admin.tg.lastTaken')}</th></tr>
            </thead>
            <tbody>
              {data.people.map((p) => (
                <tr key={p.tgId}>
                  <td>{who(p.name, p.username)}</td>
                  <td><b>{p.taken}</b></td>
                  <td>{p.last ? new Date(p.last).toLocaleString(locale) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-section-head">
        <div className="tabs" style={{ margin: 0 }}>
          {STATUSES.map((key) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'on' : ''}
              onClick={() => { setFilter(key); loadRequests(key, q).catch((err) => setError(err.message)); }}
            >
              {t(`admin.tg.status.${key}`)} {key === 'all' ? total : (counts[key] || 0)}
            </button>
          ))}
        </div>
        <input
          className="admin-search"
          value={q}
          placeholder={t('admin.tg.search')}
          onChange={(e) => { setQ(e.target.value); loadRequests(filter, e.target.value).catch((err) => setError(err.message)); }}
        />
      </div>

      {!data && <p className="muted">{t('common.loading')}</p>}
      {data && !data.requests.length && <div className="empty">{t('admin.tg.empty')}</div>}
      <div className="admin-list">
        {(data?.requests || []).map((r) => (
          <div key={r.id} className={`admin-list-item tg-req is-${r.status}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4>
                📅 {humanDate(r.date, locale)}
                {' '}
                <span className={`badge${r.status === 'taken' ? ' ok' : r.status === 'open' ? ' brand' : ''}`}>{t(`admin.tg.status.${r.status}`)}</span>
              </h4>
              <p className="tg-desc">{r.description}</p>
              <p className="muted tg-meta">
                {t('admin.tg.from', { who: who(r.creatorName, r.creatorUsername), date: new Date(r.createdAt).toLocaleString(locale) })}
                {r.status === 'taken' && <><br />✅ {t('admin.tg.takenBy', { who: who(r.takerName, r.takerUsername), date: new Date(r.takenAt).toLocaleString(locale) })}</>}
                {r.status === 'cancelled' && <><br />❌ {t('admin.tg.cancelledBy', { who: r.cancelledBy || '—', date: new Date(r.cancelledAt).toLocaleString(locale) })}</>}
              </p>
            </div>
            {r.status === 'open' && (
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => {
                  if (!window.confirm(t('admin.tg.confirmCancel'))) return;
                  run(async () => {
                    await telegramAdminApi.cancel(r.id);
                    await loadRequests();
                  });
                }}
              >
                {t('admin.tg.cancel')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

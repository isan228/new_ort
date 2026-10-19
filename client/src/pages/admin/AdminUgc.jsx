import { useEffect, useState } from 'react';
import { ugcApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Modal } from './adminUi';

function referralLink(code) {
  return `${window.location.origin}/register?ref=${encodeURIComponent(code || '')}`;
}

function UgcForm({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: initial?.name || '',
    login: initial?.login || '',
    password: '',
    phone: initial?.phone || '',
    note: initial?.note || '',
  });
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const body = { name: form.name, phone: form.phone, note: form.note };
      if (!initial) body.login = form.login;
      if (form.password) body.password = form.password;
      onSubmit(body);
    }}>
      <label className="field">
        <span>{t('admin.ugc.name')}</span>
        <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      {!initial && (
        <label className="field">
          <span>{t('common.login')}</span>
          <input value={form.login} autoComplete="off" onChange={(e) => set({ login: e.target.value })} />
        </label>
      )}
      <label className="field">
        <span>{initial ? t('admin.ed.newPassword') : t('admin.ed.password')}</span>
        <input type="text" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
        {initial && <small className="field-hint">{t('admin.ed.keepPassword')}</small>}
      </label>
      <label className="field">
        <span>{t('admin.ugc.phone')}</span>
        <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('admin.ugc.note')}</span>
        <input value={form.note} placeholder={t('admin.ugc.notePh')} onChange={(e) => set({ note: e.target.value })} />
      </label>
      <div className="row">
        <button className="btn" type="submit">{t('common.save')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

function Invitees({ account, onClose }) {
  const { t, locale } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    ugcApi.invitees(account.id).then((d) => setRows(d.invitees || [])).catch((err) => setError(err.message));
  }, [account.id]);
  return (
    <Modal title={t('admin.ugc.inviteesOf', { name: account.name })} onClose={onClose}>
      {error && <p className="err">{error}</p>}
      {!rows && !error && <p className="muted">{t('common.loading')}</p>}
      {rows && !rows.length && <div className="empty">{t('admin.ugc.noInvitees')}</div>}
      {rows && rows.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('common.login')}</th>
                <th>{t('admin.ugc.registered')}</th>
                <th>{t('admin.ugc.paidSum')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.login || '—'}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString(locale)}</td>
                  <td>{u.payments ? `${u.revenue} ${t('common.som')} · ${t('admin.ugc.paymentsN', { n: u.payments })}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default function AdminUgc() {
  const { t, locale } = useLang();
  const [accounts, setAccounts] = useState(null);
  const [modal, setModal] = useState(null);
  const [copied, setCopied] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    setAccounts((await ugcApi.list()).accounts || []);
  }

  useEffect(() => { reload().catch((err) => setError(err.message)); }, []);

  async function run(fn) {
    setError('');
    setMsg('');
    try {
      await fn();
      await reload();
      setMsg(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    }
  }

  function copy(account) {
    navigator.clipboard?.writeText(referralLink(account.referralCode));
    setCopied(account.id);
    setTimeout(() => setCopied(null), 1500);
  }

  const totals = (accounts || []).reduce((sum, a) => ({
    invited: sum.invited + a.stats.invited,
    paidUsers: sum.paidUsers + a.stats.paidUsers,
    revenue: sum.revenue + a.stats.revenue,
  }), { invited: 0, paidUsers: 0, revenue: 0 });

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.ugc.title')}</h1>
          <p className="muted">{t('admin.ugc.lead')}</p>
        </div>
        <button className="btn" type="button" onClick={() => setModal({ type: 'form' })}>{t('admin.ugc.add')}</button>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      {accounts && accounts.length > 0 && (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="card stat"><b>{accounts.length}</b><span className="muted">{t('admin.ugc.accounts')}</span></div>
          <div className="card stat"><b>{totals.invited}</b><span className="muted">{t('admin.ugc.invited')}</span></div>
          <div className="card stat"><b>{totals.paidUsers}</b><span className="muted">{t('admin.ugc.paidUsers')}</span></div>
          <div className="card stat"><b>{totals.revenue}</b><span className="muted">{t('admin.ugc.revenue')}</span></div>
        </div>
      )}

      {!accounts && !error && <p className="muted">{t('common.loading')}</p>}
      {accounts && !accounts.length && <div className="empty">{t('admin.ugc.empty')}</div>}
      <div className="admin-list">
        {(accounts || []).map((a) => (
          <div key={a.id} className={`admin-list-item ugc-item${a.active ? '' : ' is-off'}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4>
                {a.name}
                {' '}
                <span className="muted ugc-login">{a.login}</span>
                {!a.active && <span className="badge" style={{ marginLeft: 8 }}>{t('admin.ugc.disabled')}</span>}
              </h4>
              {a.note && <p className="muted" style={{ margin: '2px 0 0' }}>{a.note}</p>}
              <div className="ugc-stats">
                <span><b>{a.stats.invited}</b> {t('admin.ugc.invitedShort')}</span>
                <span><b>{a.stats.invited30}</b> {t('admin.ugc.last30')}</span>
                <span><b>{a.stats.paidUsers}</b> {t('admin.ugc.paidShort')}</span>
                <span><b>{a.stats.revenue}</b> {t('common.som')}</span>
                {a.stats.pending > 0 && <span><b>{a.stats.pending}</b> {t('admin.ugc.pendingShort')}</span>}
              </div>
              <p className="muted ugc-link">
                {referralLink(a.referralCode)}
                {a.stats.lastInviteAt && ` · ${t('admin.ugc.lastInvite', { date: new Date(a.stats.lastInviteAt).toLocaleDateString(locale) })}`}
              </p>
            </div>
            <div className="row ugc-actions">
              <button className="btn sm" type="button" onClick={() => copy(a)}>
                {copied === a.id ? t('admin.promo.copied') : t('admin.ugc.copyLink')}
              </button>
              <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'invitees', item: a })}>{t('admin.ugc.whoInvited')}</button>
              <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'form', item: a })}>{t('common.edit')}</button>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => {
                  if (a.active && !window.confirm(t('admin.ugc.confirmDisable', { name: a.name }))) return;
                  run(() => ugcApi.update(a.id, { active: !a.active }));
                }}
              >
                {a.active ? t('admin.ugc.disable') : t('admin.ugc.enable')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal?.type === 'form' && (
        <Modal title={modal.item ? t('common.edit') : t('admin.ugc.add')} onClose={() => setModal(null)}>
          <UgcForm
            initial={modal.item}
            onClose={() => setModal(null)}
            onSubmit={(body) => run(async () => {
              if (modal.item) await ugcApi.update(modal.item.id, body);
              else await ugcApi.create(body);
              setModal(null);
            })}
          />
        </Modal>
      )}
      {modal?.type === 'invitees' && <Invitees account={modal.item} onClose={() => setModal(null)} />}
    </div>
  );
}

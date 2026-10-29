import { useEffect, useState } from 'react';
import { schoolsApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Modal } from './adminUi';

const PAGE_SIZE = 50;

function SchoolForm({ school, onSave, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: school?.name || '', address: school?.address || '', region: school?.region || '', district: school?.district || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field"><span>{t('admin.schools.name')}</span><input value={form.name} onChange={set('name')} required maxLength={300} autoFocus /></label>
      <label className="field"><span>{t('admin.schools.address')}</span><input value={form.address} onChange={set('address')} maxLength={500} /></label>
      <label className="field"><span>{t('admin.schools.region')}</span><input value={form.region} onChange={set('region')} maxLength={120} placeholder={t('admin.schools.regionHint')} /></label>
      <label className="field"><span>{t('admin.schools.district')}</span><input value={form.district} onChange={set('district')} maxLength={160} /></label>
      {error && <p className="err">{error}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn" type="submit" disabled={busy}>{busy ? t('common.loading') : t('common.save')}</button>
      </div>
    </form>
  );
}

export default function AdminSchools() {
  const { t, locale } = useLang();
  const [facets, setFacets] = useState(null);
  const [filter, setFilter] = useState({ region: '', district: '', status: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    schoolsApi.facets().then(setFacets).catch((err) => setError(err.message));
  }, [reload]);

  useEffect(() => {
    const id = setTimeout(() => { setPage(1); setFilter((f) => ({ ...f, q: search.trim() })); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    schoolsApi.list({ ...filter, page, limit: PAGE_SIZE })
      .then(setData)
      .catch((err) => { setError(err.message); setData({ schools: [], total: 0 }); });
  }, [filter, page, reload]);

  const change = (key) => (e) => {
    const value = e.target.value;
    setPage(1);
    setFilter((f) => ({ ...f, [key]: value, ...(key === 'region' ? { district: '' } : {}) }));
  };

  async function runImport() {
    if (!window.confirm(t('admin.schools.importConfirm'))) return;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const res = await schoolsApi.import();
      setNotice(t('admin.schools.imported', res));
      setReload((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function save(form) {
    if (editing?.id) await schoolsApi.update(editing.id, form);
    else await schoolsApi.create(form);
    setEditing(null);
    setReload((n) => n + 1);
  }

  async function toggle(school) {
    await schoolsApi.update(school.id, { isActive: !school.isActive });
    setReload((n) => n + 1);
  }

  async function remove(school) {
    if (!window.confirm(t('admin.schools.confirmDelete', { name: school.name }))) return;
    await schoolsApi.remove(school.id);
    setReload((n) => n + 1);
  }

  const regions = facets?.regions || [];
  const districts = regions.find((r) => (r.region || '-') === filter.region)?.districts || [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const last = facets?.lastImport;

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.schools.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('admin.schools.lead', { n: facets?.total ?? '…' })}
            {last && <> · {t('admin.schools.lastImport', { date: new Date(last.at).toLocaleString(locale), n: last.fetched })}</>}
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" type="button" onClick={runImport} disabled={importing}>
            {importing ? t('admin.schools.importing') : t('admin.schools.import')}
          </button>
          <button className="btn ghost sm" type="button" onClick={() => setEditing({})}>{t('admin.schools.add')}</button>
        </div>
      </div>
      {notice && <p className="ok-note">{notice}</p>}
      {error && <p className="err">{error}</p>}

      <div className="row schools-filters">
        <select value={filter.region} onChange={change('region')}>
          <option value="">{t('admin.schools.allRegions')}</option>
          {regions.map((r) => (
            <option key={r.region || '-'} value={r.region || '-'}>{r.region || t('admin.schools.noRegion')} — {r.count}</option>
          ))}
        </select>
        <select value={filter.district} onChange={change('district')} disabled={!districts.length}>
          <option value="">{t('admin.schools.allDistricts')}</option>
          {districts.map((d) => <option key={d.district} value={d.district}>{d.district} — {d.count}</option>)}
        </select>
        <select value={filter.status} onChange={change('status')}>
          <option value="">{t('admin.schools.active')}</option>
          <option value="hidden">{t('admin.schools.hiddenN', { n: facets?.hidden ?? 0 })}</option>
          <option value="all">{t('admin.schools.everything')}</option>
        </select>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.schools.search')} />
      </div>

      {data == null && <p className="muted">{t('common.loading')}</p>}
      {data && !data.schools.length && (
        <div className="empty">{facets?.total ? t('admin.schools.nothing') : t('admin.schools.empty')}</div>
      )}
      {data?.schools.length > 0 && (
        <>
          <p className="muted" style={{ margin: '0 0 6px' }}>{t('admin.schools.found', { n: data.total })}</p>
          <div className="table-scroll">
            <table className="table schools-table">
              <thead>
                <tr>
                  <th>{t('admin.schools.name')}</th>
                  <th>{t('admin.schools.place')}</th>
                  <th>{t('admin.schools.address')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.schools.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'is-hidden'}>
                    <td>
                      <b>{s.name}</b>
                      {s.source === 'manual' && <span className="badge" style={{ marginLeft: 6 }}>{t('admin.schools.manual')}</span>}
                      {!s.isActive && <span className="badge" style={{ marginLeft: 6 }}>{t('admin.schools.hidden')}</span>}
                    </td>
                    <td>{[s.region, s.district].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="muted">{s.address || '—'}</td>
                    <td className="schools-actions">
                      <button className="btn ghost sm" type="button" onClick={() => setEditing(s)}>{t('common.edit')}</button>
                      <button className="btn ghost sm" type="button" onClick={() => toggle(s)}>{s.isActive ? t('admin.schools.hide') : t('admin.schools.show')}</button>
                      {s.source === 'manual' && <button className="btn ghost sm" type="button" onClick={() => remove(s)}>{t('common.delete')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {pages > 1 && (
        <div className="row act-pager">
          <button className="btn ghost sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="muted">{page} / {pages}</span>
          <button className="btn ghost sm" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
      <p className="muted schools-source">{t('admin.schools.source')} <a href="https://bilim.akipress.org/profiles:3/school/list/" target="_blank" rel="noreferrer">bilim.akipress.org</a></p>

      {editing && (
        <Modal title={editing.id ? t('common.edit') : t('admin.schools.add')} onClose={() => setEditing(null)}>
          <SchoolForm school={editing.id ? editing : null} onSave={save} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { simAdminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, Modal, useIsEditor } from './adminUi';
import { SIM_TRACKS, simPath } from './simUi';
import '../../styles/sim.css';

export function SimTestForm({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: initial?.name || '',
    trackGroup: initial?.trackGroup || 'subject',
    language: initial?.language || 'ru',
    isExtra: !!initial?.isExtra,
    isActive: initial?.isActive !== false,
  });
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!form.name.trim()) return;
      onSubmit({ ...form, name: form.name.trim(), language: form.trackGroup === 'main' ? form.language : 'any' });
    }}>
      <label className="field">
        <span>{t('admin.name')}</span>
        <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('admin.simulation.track')}</span>
        <select value={form.trackGroup} onChange={(e) => set({ trackGroup: e.target.value })}>
          {SIM_TRACKS.map((key) => <option key={key} value={key}>{t(`admin.simulation.tracks.${key}`)}</option>)}
        </select>
      </label>
      {form.trackGroup === 'main' && (
        <label className="field">
          <span>{t('admin.simulation.language')}</span>
          <select value={form.language} onChange={(e) => set({ language: e.target.value })}>
            <option value="ru">{t('admin.simulation.langs.ru')}</option>
            <option value="ky">{t('admin.simulation.langs.ky')}</option>
          </select>
        </label>
      )}
      {form.trackGroup === 'subject' && (
        <label className="ar-check">
          <input type="checkbox" checked={form.isExtra} onChange={(e) => set({ isExtra: e.target.checked })} />
          <span>{t('admin.simulation.isExtra')}</span>
        </label>
      )}
      <label className="ar-check">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
        <span>{t('admin.simulation.isActive')}</span>
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" type="submit">{t('common.save')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

export default function AdminSimHome() {
  const { t } = useLang();
  const navigate = useNavigate();
  const editor = useIsEditor();
  const [tests, setTests] = useState([]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    setTests((await simAdminApi.tests()).tests || []);
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

  return (
    <div>
      <Crumbs items={[{ label: t('admin.simulation.title') }]} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.simulation.title')}</h1>
          <p className="muted">{editor ? t('admin.simulation.leadEditor') : t('admin.simulation.lead')}</p>
        </div>
        {!editor && <button className="btn" type="button" onClick={() => setModal({})}>{t('admin.simulation.addTest')}</button>}
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      {SIM_TRACKS.map((track) => {
        const rows = tests.filter((row) => row.trackGroup === track);
        return (
          <section key={track} className="sim-admin-group">
            <h2>{t(`admin.simulation.tracks.${track}`)}</h2>
            <div className="admin-list">
              {!rows.length && <div className="empty">{t('admin.simulation.noTests')}</div>}
              {rows.map((row) => (
                <div key={row.id} className={`admin-list-item${row.isActive ? '' : ' is-off'}`}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4>
                      {row.name}
                      {row.isExtra && <span className="badge" style={{ marginLeft: 8 }}>{t('admin.simulation.extra')}</span>}
                    </h4>
                    <p className="muted" style={{ margin: '4px 0 0' }}>
                      {t('admin.simulation.testStats', { v: row.variants, p: row.published, n: row.topics })}
                    </p>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <button className="btn sm" type="button" onClick={() => navigate(simPath(row.id))}>{t('admin.open')}</button>
                    {!editor && (
                      <>
                        <button className="btn ghost sm" type="button" onClick={() => setModal({ item: row })}>{t('common.edit')}</button>
                        <button
                          className="btn ghost sm"
                          type="button"
                          onClick={() => {
                            if (!window.confirm(t('admin.simulation.confirmDeleteTest', { name: row.name }))) return;
                            run(() => simAdminApi.deleteTest(row.id));
                          }}
                        >
                          {t('common.delete')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {modal && (
        <Modal title={modal.item ? t('common.edit') : t('admin.simulation.addTest')} onClose={() => setModal(null)}>
          <SimTestForm
            initial={modal.item}
            onClose={() => setModal(null)}
            onSubmit={(body) => run(async () => {
              if (modal.item) await simAdminApi.updateTest(modal.item.id, body);
              else await simAdminApi.createTest(body);
              setModal(null);
            })}
          />
        </Modal>
      )}
    </div>
  );
}


import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import MathText from '../../components/MathText';
import { EDITOR_ROOT, Modal } from './adminUi';

const ACTIONS = ['create', 'update', 'delete', 'import'];
const PAGE_SIZE = 30;

function EditorForm({ editor, onSave, onClose }) {
  const { t } = useLang();
  const [name, setName] = useState(editor?.name || '');
  const [login, setLogin] = useState(editor?.login || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = editor ? { name: name.trim() } : { name: name.trim(), login: login.trim(), password };
      if (editor && password) body.password = password;
      await onSave(body);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span>{t('admin.ed.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </label>
      <label className="field">
        <span>{t('admin.ed.login')}</span>
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value.replace(/\s+/g, ''))}
          disabled={!!editor}
          spellCheck={false}
          autoComplete="off"
          required
        />
      </label>
      <label className="field">
        <span>{editor ? t('admin.ed.newPassword') : t('admin.ed.password')}</span>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          placeholder={editor ? t('admin.ed.keepPassword') : ''}
          autoComplete="new-password"
          required={!editor}
        />
      </label>
      {error && <p className="err">{error}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn" type="submit" disabled={busy}>{busy ? t('common.loading') : t('common.save')}</button>
      </div>
    </form>
  );
}

function QuestionSnapshot({ q, label }) {
  const { t } = useLang();
  if (!q) return null;
  return (
    <div className="act-snap">
      <b className="act-snap-label">{label}</b>
      {q.kind === 'compare' ? (
        <div className="act-snap-cmp">
          {q.text && <p><MathText text={q.text} /></p>}
          <p>А: <MathText text={q.compareA || ''} /></p>
          <p>Б: <MathText text={q.compareB || ''} /></p>
        </div>
      ) : (
        <p><MathText text={q.text || ''} /></p>
      )}
      {q.imageUrl && <img src={q.imageUrl} alt="" className="act-snap-img" />}
      {q.answers?.length > 0 && (
        <ol className="act-snap-answers">
          {q.answers.map((a, i) => (
            <li key={i} className={a.isCorrect ? 'ok' : ''}>
              <MathText text={a.text || ''} />
              {a.isCorrect && <span className="act-correct"> ✓</span>}
            </li>
          ))}
        </ol>
      )}
      {q.explanation && <p className="muted act-snap-expl">{t('admin.ed.explanation')}: <MathText text={q.explanation} /></p>}
    </div>
  );
}

function EntryDetails({ entry }) {
  const { t } = useLang();
  const d = entry.details || {};
  if (entry.action === 'import') {
    const items = d.items || [];
    if (!items.length) return <p className="muted">{d.message || '—'}</p>;
    return (
      <ol className="act-import-list">
        {items.map((item, i) => (
          <li key={i}>
            {item.externalId && <span className="muted">#{item.externalId} </span>}
            <MathText text={item.text || ''} />
          </li>
        ))}
      </ol>
    );
  }
  if (entry.entity === 'question') {
    return (
      <div className="act-snaps">
        <QuestionSnapshot q={d.before} label={t('admin.ed.before')} />
        <QuestionSnapshot q={d.after} label={entry.action === 'create' ? t('admin.ed.added') : t('admin.ed.after')} />
      </div>
    );
  }
  const show = (v) => (v ? v.title || v.name || '' : '—');
  return (
    <p className="muted">
      {d.before && <>{t('admin.ed.before')}: <b>{show(d.before)}</b> </>}
      {d.after && <>{t('admin.ed.after')}: <b>{show(d.after)}</b></>}
    </p>
  );
}

function ActivityEntry({ entry, locale }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className={`act-item act-${entry.action}`}>
      <button type="button" className="act-head" onClick={() => setOpen((v) => !v)}>
        <span className={`act-badge act-${entry.action}`}>{t(`admin.ed.action.${entry.action}`)}</span>
        <span className="act-main">
          <b><MathText text={entry.summary || ''} /></b>
          <span className="muted act-meta">
            {entry.userName || '—'}
            {entry.userRole === 'admin' ? ` (${t('admin.ed.roleAdmin')})` : ''}
            {' · '}
            {new Date(entry.createdAt).toLocaleString(locale)}
            {entry.place ? ` · ${entry.place}` : ''}
          </span>
        </span>
        <span className="act-toggle">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="act-body"><EntryDetails entry={entry} /></div>}
    </div>
  );
}

function ActivityLog({ editors }) {
  const { t, locale } = useLang();
  const [filter, setFilter] = useState({ userId: '', action: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    const params = { page, limit: PAGE_SIZE };
    if (filter.userId) params.userId = filter.userId;
    else params.role = 'editor';
    if (filter.action) params.action = filter.action;
    adminApi.activity(params)
      .then(setData)
      .catch((err) => { setError(err.message); setData({ items: [], total: 0 }); });
  }, [filter, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const change = (key) => (e) => { setPage(1); setFilter((f) => ({ ...f, [key]: e.target.value })); };

  return (
    <div className="act-log">
      <div className="admin-section-head">
        <h2 style={{ margin: 0 }}>{t('admin.ed.journal')}</h2>
        <div className="row act-filters">
          <select value={filter.userId} onChange={change('userId')}>
            <option value="">{t('admin.ed.allEditors')}</option>
            {editors.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={filter.action} onChange={change('action')}>
            <option value="">{t('admin.ed.allActions')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{t(`admin.ed.action.${a}`)}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="err">{error}</p>}
      {data == null && <p className="muted">{t('common.loading')}</p>}
      {data && !data.items.length && <div className="empty">{t('admin.ed.noActivity')}</div>}
      <div className="act-list">
        {(data?.items || []).map((entry) => <ActivityEntry key={entry.id} entry={entry} locale={locale} />)}
      </div>
      {pages > 1 && (
        <div className="row act-pager">
          <button className="btn ghost sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="muted">{page} / {pages}</span>
          <button className="btn ghost sm" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}

export default function AdminEditors() {
  const { t, locale } = useLang();
  const [editors, setEditors] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    adminApi.editors()
      .then((d) => setEditors(d.editors || []))
      .catch((err) => { setError(err.message); setEditors([]); });
  }, [reloadKey]);

  async function save(body) {
    if (editing === 'new') await adminApi.createEditor(body);
    else await adminApi.updateEditor(editing.id, body);
    setEditing(null);
    setReloadKey((k) => k + 1);
  }

  async function remove(editor) {
    if (!window.confirm(t('admin.ed.confirmDelete', { name: editor.name }))) return;
    try {
      await adminApi.deleteEditor(editor.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const link = `${window.location.origin}${EDITOR_ROOT}`;

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.editors')}</h1>
          <p className="muted">{t('admin.ed.lead')} <a href={EDITOR_ROOT} target="_blank" rel="noreferrer">{link}</a></p>
        </div>
        <button className="btn sm" type="button" onClick={() => setEditing('new')}>{t('admin.ed.add')}</button>
      </div>
      {error && <p className="err">{error}</p>}
      {editors == null && <p className="muted">{t('common.loading')}</p>}
      {editors && !editors.length && <div className="empty">{t('admin.ed.empty')}</div>}
      <div className="admin-list">
        {(editors || []).map((editor) => (
          <div key={editor.id} className="admin-list-item ed-item">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{editor.name} <span className="muted ed-login">@{editor.login}</span></h4>
              <div className="ed-stats">
                {ACTIONS.map((a) => (
                  <span key={a} className={`act-badge act-${a}`}>{t(`admin.ed.stat.${a}`)}: {editor.stats?.[a] || 0}</span>
                ))}
              </div>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                {t('admin.ed.lastActivity')}: {editor.lastActivity ? new Date(editor.lastActivity).toLocaleString(locale) : '—'}
              </p>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn ghost sm" type="button" onClick={() => setEditing(editor)}>{t('common.edit')}</button>
              <button className="btn ghost sm" type="button" onClick={() => remove(editor)}>{t('common.delete')}</button>
            </div>
          </div>
        ))}
      </div>

      <ActivityLog key={reloadKey} editors={editors || []} />

      {editing && (
        <Modal title={editing === 'new' ? t('admin.ed.add') : t('common.edit')} onClose={() => setEditing(null)}>
          <EditorForm editor={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

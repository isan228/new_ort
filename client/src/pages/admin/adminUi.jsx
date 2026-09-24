import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

export function contentPath(...parts) {
  const root = window.location.pathname.startsWith('/admin') ? '/admin' : '/админ';
  return [root, 'content', ...parts.filter(Boolean)].join('/');
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn ghost sm" type="button" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NameForm({ initial = '', onSubmit, onClose }) {
  const { t } = useLang();
  const [name, setName] = useState(initial);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const value = name.trim();
      if (!value) return;
      onSubmit(value);
    }}>
      <label className="field">
        <span>{t('admin.name')}</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" type="submit">{t('common.save')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

export const ORT_PART_OPTIONS = [
  { value: '', key: 'none' },
  { value: 'analogies', key: 'analogies' },
  { value: 'sentence', key: 'sentence' },
  { value: 'reading', key: 'reading' },
  { value: 'grammar', key: 'grammar' },
  { value: 'math1', key: 'math1' },
  { value: 'math2', key: 'math2' },
  { value: 'math', key: 'math' },
  { value: 'subject', key: 'subject' },
];

export function ortPartLabel(t, part) {
  if (!part) return t('admin.ortPartNone');
  return t(`admin.ortParts.${part}`);
}

export function SectionForm({ initialName = '', initialOrtPart = '', onSubmit, onClose }) {
  const { t } = useLang();
  const [name, setName] = useState(initialName);
  const [ortPart, setOrtPart] = useState(initialOrtPart || '');

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const value = name.trim();
      if (!value) return;
      onSubmit({ name: value, ortPart: ortPart || null });
    }}>
      <label className="field">
        <span>{t('admin.name')}</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('admin.ortPart')}</span>
        <select value={ortPart} onChange={(e) => setOrtPart(e.target.value)}>
          {ORT_PART_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.value}>{ortPartLabel(t, opt.value)}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <button className="btn" type="submit">{t('common.save')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

export function InlineAdd({ value, placeholder, onChange, onSubmit, onCancel, extra }) {
  const { t } = useLang();
  return (
    <form
      className="admin-inline-add"
      onSubmit={(e) => {
        e.preventDefault();
        const name = (value || '').trim();
        if (!name) return;
        onSubmit(name);
      }}
    >
      <input autoFocus value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {extra}
      <button className="btn sm" type="submit">{t('common.add')}</button>
      <button className="btn ghost sm" type="button" onClick={onCancel}>{t('common.cancel')}</button>
    </form>
  );
}

function pickTxtFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export function TxtUploadButtons({ testId, subjectId, disabled, onDone }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  async function upload(kind) {
    const file = await pickTxtFile();
    if (!file) return;
    setBusy(true);
    try {
      const url = kind === 'linked'
        ? '/api/admin/upload-txt-linked'
        : '/api/admin/upload-txt-explained';
      const extra = subjectId && !testId ? { subjectId } : {};
      const data = await adminApi.uploadTxt(url, testId, file, extra);
      await onDone(data.message || t('admin.uploadedN', { n: data.total || 0 }));
    } catch (err) {
      await onDone(null, err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-txt-row">
      <button className="btn sm" type="button" disabled={disabled || busy} onClick={() => upload('explained')}>
        {t('admin.txtExplained')}
      </button>
      <button className="btn ghost sm" type="button" disabled={disabled || busy} onClick={() => upload('linked')}>
        {t('admin.txtLinked')}
      </button>
    </div>
  );
}

export function Crumbs({ items }) {
  return (
    <nav className="admin-crumbs">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`}>
            {i > 0 && <i>/</i>}
            {last || !item.to ? <b>{item.label}</b> : <Link to={item.to}>{item.label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

export function previewText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
}

export function confirmDelete(t) {
  return window.confirm(t('common.delete'));
}

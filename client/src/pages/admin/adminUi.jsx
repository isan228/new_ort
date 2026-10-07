import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import TxtPreview from './TxtPreview';

export const EDITOR_ROOT = '/redact';

export function useIsEditor() {
  return useAuth().user?.role === 'editor';
}

export function contentPath(...parts) {
  const path = window.location.pathname;
  let root = '/админ';
  if (path.startsWith('/admin')) root = '/admin';
  else if (path.startsWith(EDITOR_ROOT)) root = EDITOR_ROOT;
  return [root, 'content', ...parts.filter(Boolean)].join('/');
}

export const CONTENT_CHANGED = 'admin-content-changed';

export async function loadSubjects() {
  const { subjects } = await adminApi.subjects();
  window.dispatchEvent(new CustomEvent(CONTENT_CHANGED, { detail: subjects }));
  return subjects;
}

export const MAIN_SUBJECT_NAME = 'Основной тест ОРТ';

export function splitSubjects(subjects) {
  const main = subjects.find((row) => row.name === MAIN_SUBJECT_NAME) || null;
  return { main, others: subjects.filter((row) => row !== main) };
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

export const SECTION_KINDS = ['standard', 'geometry', 'compare', 'reading', 'group'];
export const QUESTION_KINDS = ['standard', 'geometry'];

export function sectionKind(section) {
  return section?.kind || (section?.ortPart === 'reading' ? 'reading' : 'standard');
}

export function kindLabel(t, kind) {
  return t(`admin.kinds.${kind || 'standard'}`);
}

export function sectionChain(sections, id) {
  const byId = new Map(sections.map((row) => [String(row.id), row]));
  const chain = [];
  let current = byId.get(String(id));
  while (current && chain.length < 10) {
    chain.unshift(current);
    current = current.parentId ? byId.get(String(current.parentId)) : null;
  }
  return chain;
}

export function sectionStats(t, section, sections) {
  const kind = sectionKind(section);
  if (kind === 'group') {
    const n = sections.filter((row) => row.parentId === section.id).length;
    return t('admin.subsectionsCount', { n });
  }
  if (kind === 'reading') {
    return t('admin.reading.summary', { texts: section.passageCount || 0, n: section.questionCount || 0 });
  }
  return t('admin.questionsCount', { n: section.questionCount || 0 });
}

export function SectionForm({
  initialName = '',
  initialOrtPart = '',
  initialKind = 'standard',
  showOrtPart = true,
  onSubmit,
  onClose,
}) {
  const { t } = useLang();
  const [name, setName] = useState(initialName);
  const [ortPart, setOrtPart] = useState(initialOrtPart || '');
  const [kind, setKind] = useState(initialKind || 'standard');

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const value = name.trim();
      if (!value) return;
      onSubmit(showOrtPart ? { name: value, kind, ortPart: ortPart || null } : { name: value, kind });
    }}>
      <label className="field">
        <span>{t('admin.name')}</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field">
        <span>{t('admin.kind')}</span>
        <div className="kind-picker">
          {SECTION_KINDS.map((key) => (
            <button
              key={key}
              type="button"
              className={`kind-option${kind === key ? ' on' : ''}`}
              onClick={() => setKind(key)}
            >
              <b>{kindLabel(t, key)}</b>
              <small>{t(`admin.kindHints.${key}`)}</small>
            </button>
          ))}
        </div>
      </div>
      {showOrtPart && (
        <label className="field">
          <span>{t('admin.ortPart')}</span>
          <select value={ortPart} onChange={(e) => setOrtPart(e.target.value)}>
            {ORT_PART_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.value}>{ortPartLabel(t, opt.value)}</option>
            ))}
          </select>
          <small className="field-hint">{t('admin.ortPartHint')}</small>
        </label>
      )}
      <div className="row">
        <button className="btn" type="submit">{t('common.save')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

export function SectionList({ sections, all, onOpen, onEdit, onDelete, emptyText }) {
  const { t } = useLang();
  return (
    <div className="admin-list">
      {!sections.length && <div className="empty">{emptyText}</div>}
      {sections.map((section) => {
        const kind = sectionKind(section);
        return (
          <div key={section.id} className="admin-list-item">
            <span className={`kind-badge kind-${kind}`}>{kindLabel(t, kind)}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{section.name}</h4>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {sectionStats(t, section, all)}
                {section.ortPart && !section.parentId ? ` · ${ortPartLabel(t, section.ortPart)}` : ''}
              </p>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" type="button" onClick={() => onOpen(section)}>{t('admin.open')}</button>
              {onEdit && <button className="btn ghost sm" type="button" onClick={() => onEdit(section)}>{t('common.edit')}</button>}
              {onDelete && <button className="btn ghost sm" type="button" onClick={() => onDelete(section)}>{t('common.delete')}</button>}
            </div>
          </div>
        );
      })}
    </div>
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

export function TxtUploadButtons({ testId, subjectId, passageId, disabled, requireImage = false, onDone }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  async function upload() {
    const file = await pickTxtFile();
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await adminApi.parseTxt(file, 'explained');
      setPreview({ fileName: file.name, parsed });
    } catch (err) {
      await onDone(null, err.message);
    } finally {
      setBusy(false);
    }
  }

  let target = { subjectId };
  if (passageId) target = { passageId };
  else if (testId) target = { testId };

  return (
    <div className="admin-txt-row">
      <button className="btn sm" type="button" disabled={disabled || busy} onClick={upload}>
        {busy ? t('common.loading') : t('admin.txtExplained')}
      </button>
      {preview && (
        <TxtPreview
          fileName={preview.fileName}
          parsed={preview.parsed}
          target={target}
          requireImage={requireImage}
          onClose={() => setPreview(null)}
          onSaved={async (message) => {
            setPreview(null);
            await onDone(message);
          }}
        />
      )}
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

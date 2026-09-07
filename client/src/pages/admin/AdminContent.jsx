import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

function Modal({ title, onClose, children }) {
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

function NameForm({ initial = '', onSubmit, onClose }) {
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

function OptionalList({
  title,
  items,
  adding,
  draft,
  placeholder,
  addLabel,
  onDraft,
  onStartAdd,
  onCancelAdd,
  onAdd,
  onEdit,
  onDelete,
  itemMeta,
  itemExtra,
  footer,
}) {
  const { t } = useLang();

  return (
    <div className="admin-optional-block">
      <p className="admin-block-label">
        {title}
        <span className="admin-optional">{t('admin.optional')}</span>
      </p>
      {!!items.length && (
        <div className="admin-list">
          {items.map((item) => (
            <div key={item.id} className="admin-list-item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4>{item.name}</h4>
                {itemMeta && <p className="muted" style={{ margin: '4px 0 0' }}>{itemMeta(item)}</p>}
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {itemExtra && itemExtra(item)}
                <button className="btn ghost sm" type="button" onClick={() => onEdit(item)}>{t('common.edit')}</button>
                <button className="btn ghost sm" type="button" onClick={() => onDelete(item)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <form
          className="admin-inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            const name = (draft || '').trim();
            if (!name) return;
            onAdd(name);
          }}
        >
          <input autoFocus value={draft || ''} placeholder={placeholder} onChange={(e) => onDraft(e.target.value)} />
          <button className="btn sm" type="submit">{t('common.add')}</button>
          <button className="btn ghost sm" type="button" onClick={onCancelAdd}>{t('common.cancel')}</button>
        </form>
      ) : (
        <button className="btn ghost sm" type="button" onClick={onStartAdd}>{addLabel}</button>
      )}
      {footer}
    </div>
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

function TxtUploadButtons({ testId, subjectId, onDone }) {
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
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <button className="btn sm" type="button" disabled={busy} onClick={() => upload('explained')}>
        {t('admin.txtExplained')}
      </button>
      <button className="btn ghost sm" type="button" disabled={busy} onClick={() => upload('linked')}>
        {t('admin.txtLinked')}
      </button>
    </div>
  );
}

export default function AdminContent() {
  const { t } = useLang();
  const [subjects, setSubjects] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [tagDraft, setTagDraft] = useState({});
  const [addingTag, setAddingTag] = useState(null);
  const [sectionDraft, setSectionDraft] = useState({});
  const [addingSection, setAddingSection] = useState(null);

  async function reload() {
    setSubjects((await adminApi.subjects()).subjects);
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, []);

  async function run(fn, ok = t('admin.saved')) {
    setError('');
    setMsg('');
    try {
      const result = await fn();
      await reload();
      setMsg(ok);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  function confirmDelete() {
    return window.confirm(t('common.delete'));
  }

  async function afterUpload(ok, err) {
    if (err) {
      setMsg('');
      setError(err);
      return;
    }
    setError('');
    setMsg(ok);
    await reload();
  }

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.program')}</h1>
          <p className="muted">{t('admin.programLead')}</p>
        </div>
        <button className="btn" type="button" onClick={() => setModal({ type: 'subject' })}>
          {t('admin.addSubject')}
        </button>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      {!subjects.length && <div className="empty">{t('admin.noSubjects')}</div>}

      <div className="admin-subject-grid">
        {subjects.map((subject) => {
          const tags = subject.tags || subject.QuestionTags || [];
          const sections = subject.sections || subject.Tests || [];
          return (
            <article key={subject.id} className="card admin-subject-card">
              <div className="admin-section-head" style={{ marginTop: 0 }}>
                <h2 style={{ margin: 0 }}>{subject.name}</h2>
                <div className="row">
                  <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'subject', item: subject })}>
                    {t('common.edit')}
                  </button>
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => {
                      if (!confirmDelete()) return;
                      run(() => adminApi.deleteSubject(subject.id));
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              <OptionalList
                title={t('admin.tags')}
                items={tags}
                adding={addingTag === subject.id}
                draft={tagDraft[subject.id]}
                placeholder={t('admin.newTag')}
                addLabel={t('admin.addTag')}
                onDraft={(value) => setTagDraft((prev) => ({ ...prev, [subject.id]: value }))}
                onStartAdd={() => setAddingTag(subject.id)}
                onCancelAdd={() => setAddingTag(null)}
                onAdd={(name) => run(async () => {
                  await adminApi.createTag({ name, subjectId: subject.id });
                  setTagDraft((prev) => ({ ...prev, [subject.id]: '' }));
                  setAddingTag(null);
                })}
                onEdit={(item) => setModal({ type: 'tag', item })}
                onDelete={(item) => {
                  if (!confirmDelete()) return;
                  run(() => adminApi.deleteTag(item.id));
                }}
              />

              <OptionalList
                title={t('admin.sections')}
                items={sections}
                adding={addingSection === subject.id}
                draft={sectionDraft[subject.id]}
                placeholder={t('admin.sectionName')}
                addLabel={t('admin.addSection')}
                onDraft={(value) => setSectionDraft((prev) => ({ ...prev, [subject.id]: value }))}
                onStartAdd={() => setAddingSection(subject.id)}
                onCancelAdd={() => setAddingSection(null)}
                onAdd={(name) => run(async () => {
                  await adminApi.createTest({ name, subjectId: subject.id });
                  setSectionDraft((prev) => ({ ...prev, [subject.id]: '' }));
                  setAddingSection(null);
                })}
                onEdit={(item) => setModal({ type: 'section', item })}
                onDelete={(item) => {
                  if (!confirmDelete()) return;
                  run(() => adminApi.deleteTest(item.id));
                }}
                itemMeta={(item) => t('admin.questionsCount', { n: item.questionCount || 0 })}
                itemExtra={(item) => (
                  <TxtUploadButtons testId={item.id} onDone={afterUpload} />
                )}
                footer={(
                  <>
                    {!sections.length && (
                      <div className="admin-upload-block">
                        <p className="admin-block-label">{t('admin.questionsBlock')}</p>
                        <TxtUploadButtons subjectId={subject.id} onDone={afterUpload} />
                      </div>
                    )}
                    <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{t('admin.txtHint')}</p>
                  </>
                )}
              />
            </article>
          );
        })}
      </div>

      {modal?.type === 'subject' && (
        <Modal title={modal.item ? t('common.edit') : t('admin.addSubject')} onClose={() => setModal(null)}>
          <NameForm
            initial={modal.item?.name || ''}
            onClose={() => setModal(null)}
            onSubmit={(name) => {
              run(async () => {
                if (modal.item) {
                  await adminApi.updateSubject(modal.item.id, { name });
                  setModal(null);
                  return;
                }
                const { subject } = await adminApi.createSubject({ name });
                setModal(null);
                setAddingTag(subject.id);
              });
            }}
          />
        </Modal>
      )}

      {modal?.type === 'tag' && (
        <Modal title={t('common.edit')} onClose={() => setModal(null)}>
          <NameForm
            initial={modal.item?.name || ''}
            onClose={() => setModal(null)}
            onSubmit={(name) => {
              run(async () => {
                await adminApi.updateTag(modal.item.id, { name });
                setModal(null);
              });
            }}
          />
        </Modal>
      )}

      {modal?.type === 'section' && (
        <Modal title={t('common.edit')} onClose={() => setModal(null)}>
          <NameForm
            initial={modal.item?.name || ''}
            onClose={() => setModal(null)}
            onSubmit={(name) => {
              run(async () => {
                await adminApi.updateTest(modal.item.id, { name });
                setModal(null);
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
}

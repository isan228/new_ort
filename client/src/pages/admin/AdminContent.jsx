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

export default function AdminContent() {
  const { t } = useLang();
  const [subjects, setSubjects] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [tagDraft, setTagDraft] = useState({});
  const [sectionDraft, setSectionDraft] = useState({});
  const [editingTag, setEditingTag] = useState(null);
  const [tagEditName, setTagEditName] = useState('');

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
      await fn();
      await reload();
      setMsg(ok);
    } catch (err) {
      setError(err.message);
    }
  }

  function confirmDelete() {
    return window.confirm(t('common.delete'));
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

              <p className="admin-block-label">{t('admin.tags')}</p>
              <div className="admin-chip-row">
                {tags.map((tag) => (
                  editingTag === tag.id ? (
                    <form
                      key={tag.id}
                      className="admin-inline-add"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = tagEditName.trim();
                        if (!name) return;
                        run(async () => {
                          await adminApi.updateTag(tag.id, { name });
                          setEditingTag(null);
                        });
                      }}
                    >
                      <input
                        autoFocus
                        value={tagEditName}
                        onChange={(e) => setTagEditName(e.target.value)}
                        onBlur={() => {
                          const name = tagEditName.trim();
                          if (name && name !== tag.name) {
                            run(async () => {
                              await adminApi.updateTag(tag.id, { name });
                              setEditingTag(null);
                            });
                          } else {
                            setEditingTag(null);
                          }
                        }}
                      />
                    </form>
                  ) : (
                    <span key={tag.id} className="admin-chip">
                      <button
                        type="button"
                        className="admin-chip-name"
                        onClick={() => {
                          setEditingTag(tag.id);
                          setTagEditName(tag.name);
                        }}
                      >
                        {tag.name}
                      </button>
                      <button
                        type="button"
                        className="admin-chip-x"
                        aria-label={t('common.delete')}
                        onClick={() => {
                          if (!confirmDelete()) return;
                          run(() => adminApi.deleteTag(tag.id));
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )
                ))}
                {!tags.length && <span className="muted">{t('admin.noTags')}</span>}
              </div>
              <form
                className="admin-inline-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = (tagDraft[subject.id] || '').trim();
                  if (!name) return;
                  run(async () => {
                    await adminApi.createTag({ name, subjectId: subject.id });
                    setTagDraft((prev) => ({ ...prev, [subject.id]: '' }));
                  });
                }}
              >
                <input
                  value={tagDraft[subject.id] || ''}
                  placeholder={t('admin.newTag')}
                  onChange={(e) => setTagDraft((prev) => ({ ...prev, [subject.id]: e.target.value }))}
                />
                <button className="btn sm" type="submit">{t('admin.addTag')}</button>
              </form>

              <p className="admin-block-label">{t('admin.sections')}</p>
              <div className="admin-list">
                {sections.map((section) => (
                  <div key={section.id} className="admin-list-item">
                    <h4>{section.name}</h4>
                    <div className="row">
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => setModal({ type: 'section', item: section, subjectId: subject.id })}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => {
                          if (!confirmDelete()) return;
                          run(() => adminApi.deleteTest(section.id));
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                ))}
                {!sections.length && <p className="muted" style={{ margin: 0 }}>{t('admin.noSections')}</p>}
              </div>
              <form
                className="admin-inline-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = (sectionDraft[subject.id] || '').trim();
                  if (!name) return;
                  run(async () => {
                    await adminApi.createTest({ name, subjectId: subject.id });
                    setSectionDraft((prev) => ({ ...prev, [subject.id]: '' }));
                  });
                }}
              >
                <input
                  value={sectionDraft[subject.id] || ''}
                  placeholder={t('admin.sectionName')}
                  onChange={(e) => setSectionDraft((prev) => ({ ...prev, [subject.id]: e.target.value }))}
                />
                <button className="btn sm" type="submit">{t('admin.addSection')}</button>
              </form>
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
                if (modal.item) await adminApi.updateSubject(modal.item.id, { name });
                else await adminApi.createSubject({ name });
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

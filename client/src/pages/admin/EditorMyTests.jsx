import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { Modal, NameForm, confirmDelete, contentPath, loadSubjects } from './adminUi';

// The subjects (tests) this editor created: theirs to structure, unlike the ones the admin opened to them.
export default function EditorMyTests() {
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  async function reload() {
    const all = await loadSubjects();
    setSubjects(all.filter((s) => s.createdById === user?.id));
  }

  useEffect(() => {
    reload().catch((err) => { setError(err.message); setSubjects([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function run(fn) {
    setError('');
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.myTests.title')}</h1>
          <p className="muted">{t('admin.myTests.lead')}</p>
        </div>
        <button className="btn" type="button" onClick={() => setModal({})}>{t('admin.myTests.add')}</button>
      </div>
      {error && <p className="err">{error}</p>}
      {subjects == null && <p className="muted">{t('common.loading')}</p>}
      {subjects && !subjects.length && <div className="empty">{t('admin.myTests.empty')}</div>}
      <div className="admin-list">
        {(subjects || []).map((subject) => (
          <div key={subject.id} className="admin-list-item">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{subject.name}</h4>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {t('admin.sectionsCount', { n: (subject.sections || []).filter((row) => !row.parentId).length })}
                {' · '}
                {t('admin.questionsCount', { n: subject.questionCount || 0 })}
              </p>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" type="button" onClick={() => navigate(contentPath(subject.id))}>{t('admin.open')}</button>
              <button className="btn ghost sm" type="button" onClick={() => setModal({ item: subject })}>{t('common.edit')}</button>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => { if (confirmDelete(t)) run(() => adminApi.deleteSubject(subject.id)); }}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <Modal title={modal.item ? t('common.edit') : t('admin.myTests.add')} onClose={() => setModal(null)}>
          <NameForm
            initial={modal.item?.name || ''}
            onClose={() => setModal(null)}
            onSubmit={(name) => run(async () => {
              if (modal.item) {
                await adminApi.updateSubject(modal.item.id, { name });
                setModal(null);
                return;
              }
              const { subject } = await adminApi.createSubject({ name });
              setModal(null);
              navigate(contentPath(subject.id));
            })}
          />
        </Modal>
      )}
    </div>
  );
}

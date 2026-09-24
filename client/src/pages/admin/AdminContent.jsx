import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, Modal, NameForm, confirmDelete, contentPath } from './adminUi';

export default function AdminContent() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

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

  return (
    <div>
      <Crumbs items={[{ label: t('admin.program') }]} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.subjects')}</h1>
          <p className="muted">{t('admin.programLead')}</p>
        </div>
        <button className="btn" type="button" onClick={() => setModal({ type: 'subject' })}>
          {t('admin.addSubject')}
        </button>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      <div className="admin-list">
        {!subjects.length && <div className="empty">{t('admin.noSubjects')}</div>}
        {subjects.map((subject) => {
          const sections = subject.sections || subject.Tests || [];
          const tags = subject.tags || subject.QuestionTags || [];
          return (
            <div key={subject.id} className="admin-list-item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4>{subject.name}</h4>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {t('admin.sectionsCount', { n: sections.length })}
                  {' · '}
                  {t('admin.tagsCount', { n: tags.length })}
                  {' · '}
                  {t('admin.questionsCount', { n: subject.questionCount || 0 })}
                </p>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn sm" type="button" onClick={() => navigate(contentPath(subject.id))}>
                  {t('admin.open')}
                </button>
                <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'subject', item: subject })}>
                  {t('common.edit')}
                </button>
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => {
                    if (!confirmDelete(t)) return;
                    run(() => adminApi.deleteSubject(subject.id));
                  }}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
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
                else {
                  const { subject } = await adminApi.createSubject({ name });
                  setModal(null);
                  navigate(contentPath(subject.id));
                  return;
                }
                setModal(null);
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
}

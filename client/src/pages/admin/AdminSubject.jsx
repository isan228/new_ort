import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, Modal, NameForm, SectionForm, SectionList, confirmDelete, contentPath, loadSubjects, sectionKind, useIsEditor } from './adminUi';

export default function AdminSubject() {
  const { t } = useLang();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const editor = useIsEditor();

  async function reload() {
    const list = await loadSubjects();
    const found = list.find((row) => String(row.id) === String(subjectId));
    if (!found) {
      navigate(contentPath(), { replace: true });
      return null;
    }
    setSubject(found);
    return found;
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, [subjectId]);

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

  if (!subject) return <p className="muted">{t('common.loading')}</p>;

  const all = subject.sections || [];
  const sections = all.filter((row) => !row.parentId);

  return (
    <div>
      <Crumbs items={[
        { label: t('admin.subjects'), to: contentPath() },
        { label: subject.name },
      ]} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{subject.name}</h1>
          <p className="muted">{t('admin.subjectLead')}</p>
        </div>
        {!editor && <div className="row">
          <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'subject', item: subject })}>
            {t('common.edit')}
          </button>
          <button
            className="btn ghost sm"
            type="button"
            onClick={() => {
              if (!confirmDelete(t)) return;
              run(async () => {
                await adminApi.deleteSubject(subject.id);
                navigate(contentPath());
              });
            }}
          >
            {t('common.delete')}
          </button>
        </div>}
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      <div className="admin-section-head">
        <h2 style={{ margin: 0 }}>{t('admin.sections')}</h2>
        {!editor && (
          <button className="btn" type="button" onClick={() => setModal({ type: 'section', item: null })}>
            {t('admin.addSection')}
          </button>
        )}
      </div>
      <SectionList
        sections={sections}
        all={all}
        emptyText={t('admin.noSections')}
        onOpen={(section) => navigate(contentPath(subject.id, section.id))}
        onEdit={editor ? null : (section) => setModal({ type: 'section', item: section })}
        onDelete={editor ? null : (section) => {
          if (!window.confirm(t('admin.confirmDeleteSection', { name: section.name }))) return;
          run(() => adminApi.deleteTest(section.id));
        }}
      />

      {modal?.type === 'subject' && (
        <Modal title={t('common.edit')} onClose={() => setModal(null)}>
          <NameForm
            initial={modal.item?.name || ''}
            onClose={() => setModal(null)}
            onSubmit={(name) => {
              run(async () => {
                await adminApi.updateSubject(modal.item.id, { name });
                setModal(null);
              });
            }}
          />
        </Modal>
      )}
      {modal?.type === 'section' && (
        <Modal title={modal.item ? t('common.edit') : t('admin.addSection')} onClose={() => setModal(null)}>
          <SectionForm
            initialName={modal.item?.name || ''}
            initialOrtPart={modal.item?.ortPart || ''}
            initialKind={modal.item ? sectionKind(modal.item) : 'standard'}
            onClose={() => setModal(null)}
            onSubmit={(body) => {
              run(async () => {
                if (modal.item) await adminApi.updateTest(modal.item.id, body);
                else await adminApi.createTest({ ...body, subjectId: subject.id });
                setModal(null);
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
}

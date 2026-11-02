import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import BulkTopicUpload, { BULK_FORMATS } from './BulkTopicUpload';
import QuickUpload from './QuickUpload';
import { Crumbs, Modal, NameForm, SectionForm, SectionList, confirmDelete, contentPath, loadSubjects, sectionKind, subjectKinds, useCanManage } from './adminUi';

// Sections that take questions, in tree order, labelled with their path ("Русский язык / Фонетика").
function uploadTargets(all) {
  const order = (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id;
  const out = [];
  const walk = (parentId, path) => {
    for (const row of all.filter((r) => (r.parentId || null) === parentId).sort(order)) {
      const label = [...path, row.name].join(' / ');
      const format = sectionKind(row);
      if (BULK_FORMATS.includes(format)) out.push({ key: String(row.id), testId: row.id, name: row.name, label, format });
      walk(row.id, [...path, row.name]);
    }
  };
  walk(null, []);
  return out;
}

export default function AdminSubject() {
  const { t } = useLang();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const canManage = useCanManage();

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
  const editor = !canManage(subject);
  const targets = uploadTargets(all);

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
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {targets.length > 1 && (
            <BulkTopicUpload targets={targets} onDone={(ok, err) => (err ? setError(err) : run(async () => {}, ok))} />
          )}
          {!editor && (
            <button className="btn" type="button" onClick={() => setModal({ type: 'section', item: null })}>
              {t('admin.addSection')}
            </button>
          )}
        </div>
      </div>
      <SectionList
        sections={sections}
        all={all}
        emptyText={t('admin.noSections')}
        onOpen={(section) => navigate(contentPath(subject.id, section.id))}
        renderActions={(section) => (
          <QuickUpload
            testId={section.id}
            format={sectionKind(section)}
            onDone={(ok, err) => (err ? setError(err) : run(async () => {}, ok))}
          />
        )}
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
            initialKind={modal.item ? sectionKind(modal.item) : null}
            kinds={subjectKinds(subject)}
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

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, InlineAdd, Modal, NameForm, SectionForm, ORT_PART_OPTIONS, ortPartLabel, confirmDelete, contentPath } from './adminUi';

export default function AdminSubject() {
  const { t } = useLang();
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [sectionDraft, setSectionDraft] = useState('');
  const [sectionPart, setSectionPart] = useState('');
  const [addingSection, setAddingSection] = useState(false);

  async function reload() {
    const list = (await adminApi.subjects()).subjects;
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

  const tags = subject.tags || subject.QuestionTags || [];
  const sections = subject.sections || subject.Tests || [];

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
        <div className="row">
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
        </div>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      <section className="card">
        <div className="admin-section-head" style={{ marginTop: 0 }}>
          <h2 style={{ margin: 0 }}>
            {t('admin.tags')}
            <span className="admin-optional">{t('admin.optional')}</span>
          </h2>
          {!addingTag && (
            <button className="btn ghost sm" type="button" onClick={() => setAddingTag(true)}>
              {t('admin.addTag')}
            </button>
          )}
        </div>
        <div className="admin-chip-row">
          {tags.map((tag) => (
            <span key={tag.id} className="admin-chip">
              <button type="button" className="admin-chip-name" onClick={() => setModal({ type: 'tag', item: tag })}>
                {tag.name}
              </button>
              <button
                type="button"
                className="admin-chip-x"
                aria-label={t('common.delete')}
                onClick={() => {
                  if (!confirmDelete(t)) return;
                  run(() => adminApi.deleteTag(tag.id));
                }}
              >
                ×
              </button>
            </span>
          ))}
          {!tags.length && !addingTag && <span className="muted">{t('admin.noTags')}</span>}
        </div>
        {addingTag && (
          <InlineAdd
            value={tagDraft}
            placeholder={t('admin.newTag')}
            onChange={setTagDraft}
            onCancel={() => { setAddingTag(false); setTagDraft(''); }}
            onSubmit={(name) => run(async () => {
              await adminApi.createTag({ name, subjectId: subject.id });
              setTagDraft('');
              setAddingTag(false);
            })}
          />
        )}
      </section>

      <div className="admin-section-head">
        <h2 style={{ margin: 0 }}>
          {t('admin.sections')}
          <span className="admin-optional">{t('admin.optional')}</span>
        </h2>
        {!addingSection && (
          <button className="btn" type="button" onClick={() => setAddingSection(true)}>
            {t('admin.addSection')}
          </button>
        )}
      </div>
      {addingSection && (
        <InlineAdd
          value={sectionDraft}
          placeholder={t('admin.sectionName')}
          onChange={setSectionDraft}
          onCancel={() => { setAddingSection(false); setSectionDraft(''); setSectionPart(''); }}
          extra={(
            <select className="admin-inline-select" value={sectionPart} onChange={(e) => setSectionPart(e.target.value)}>
              {ORT_PART_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.value}>{ortPartLabel(t, opt.value)}</option>
              ))}
            </select>
          )}
          onSubmit={(name) => run(async () => {
            await adminApi.createTest({ name, subjectId: subject.id, ortPart: sectionPart || null });
            setSectionDraft('');
            setSectionPart('');
            setAddingSection(false);
          })}
        />
      )}
      <div className="admin-list">
        {!sections.length && <div className="empty">{t('admin.noSections')}</div>}
        {sections.map((section) => (
          <div key={section.id} className="admin-list-item">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{section.name}</h4>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {t('admin.questionsCount', { n: section.questionCount || 0 })}
                {section.ortPart ? ` · ${ortPartLabel(t, section.ortPart)}` : ''}
              </p>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" type="button" onClick={() => navigate(contentPath(subject.id, section.id))}>
                {t('admin.open')}
              </button>
              <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'section', item: section })}>
                {t('common.edit')}
              </button>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => {
                  if (!confirmDelete(t)) return;
                  run(() => adminApi.deleteTest(section.id));
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

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
          <SectionForm
            initialName={modal.item?.name || ''}
            initialOrtPart={modal.item?.ortPart || ''}
            onClose={() => setModal(null)}
            onSubmit={({ name, ortPart }) => {
              run(async () => {
                await adminApi.updateTest(modal.item.id, { name, ortPart });
                setModal(null);
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
}

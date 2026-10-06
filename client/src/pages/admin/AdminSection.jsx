import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import {
  Crumbs,
  Modal,
  QUESTION_KINDS,
  SectionForm,
  SectionList,
  TxtUploadButtons,
  confirmDelete,
  contentPath,
  kindLabel,
  loadSubjects,
  previewText,
  sectionChain,
  sectionKind,
} from './adminUi';
import QuestionForm, { draftPayload, draftProblem, toDraft } from './QuestionForm';
import { PassageText } from '../../components/PassageText';
import { splitParagraphs } from '../../lib/reading';
import { pickTextFile, readTextFile, splitTitle } from '../../lib/textFile';
import CompareBlock from './AdminCompare';
import MixedUploadButton from './MixedTxtPreview';
import { isCompare } from '../../lib/compare';
import '../../styles/reading-book.css';

function QuestionModal({ testId, initial, requireImage = false, onClose, onSaved }) {
  const { t } = useLang();
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const problem = draftProblem(draft, { requireImage });

  function close() {
    const touched = draft.dirty && (
      draft.id || draft.text.trim() || draft.imageUrl || draft.answers.some((a) => a.text.trim() || a.imageUrl)
    );
    if (touched && !window.confirm(t('admin.preview.confirmClose'))) return;
    onClose();
  }

  async function save() {
    if (problem) { setError(t(problem)); return; }
    setBusy(true);
    setError('');
    try {
      const body = draftPayload(draft);
      if (draft.id) await adminApi.updateQuestion(draft.id, body);
      else await adminApi.createQuestion({ ...body, testId });
      await onSaved(t('admin.saved'));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={draft.id ? t('admin.q.edit') : t('admin.q.new')} onClose={close}>
      <QuestionForm draft={draft} onChange={setDraft} />
      {error && <p className="err">{error}</p>}
      <div className="row qf-footer">
        <button type="button" className="btn ghost" onClick={close}>{t('admin.q.cancel')}</button>
        <button type="button" className="btn" onClick={save} disabled={busy}>
          {busy ? t('common.loading') : t('admin.q.save')}
        </button>
      </div>
    </Modal>
  );
}

export function PassageUploadPreview({ file, initial, testId, onClose, onCreated }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const count = splitParagraphs(form.body).length;

  useEffect(() => {
    document.body.classList.add('tp-open');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('tp-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function save() {
    if (!form.title.trim()) { setError(t('admin.reading.errTitle')); setEditing(true); return; }
    if (!count) { setError(t('admin.reading.errBody')); setEditing(true); return; }
    setBusy(true);
    setError('');
    try {
      const { passage } = await adminApi.createPassage({ ...form, testId, isActive: true });
      onCreated(passage);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="rp-overlay" role="dialog" aria-modal="true">
      <div className="rp-panel">
        <header className="rp-head">
          <div>
            <b>{t('admin.reading.uploadTitle')}</b>
            <span className="muted">{file} · {t('admin.reading.paragraphs', { n: count })}</span>
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose}>×</button>
        </header>

        <div className="rp-body">
          <div className="rp-fields">
            <label className="field">
              <span>{t('admin.reading.fTitle')}</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('admin.reading.fSubtitle')}</span>
              <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </label>
            <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEditing(!editing)}>
              {editing ? t('admin.reading.hideEdit') : t('admin.reading.fixText')}
            </button>
            {editing && (
              <label className="field">
                <span>{t('admin.reading.fBody')}</span>
                <textarea
                  className="ar-body"
                  rows={14}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
                <small className="field-hint">{t('admin.reading.bodyHint')}</small>
              </label>
            )}
            <ol className="ar-steps">
              <li className="on">{t('admin.reading.step1')}</li>
              <li>{t('admin.reading.step2')}</li>
            </ol>
          </div>
          <div className="rb rb-embed theme-light measure-normal rp-book">
            <div className="rb-page rb-left">
              <PassageText passage={form} number={1} pageNo={1} t={t} />
            </div>
          </div>
        </div>

        <footer className="rp-foot">
          {error && <span className="err">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={onClose}>{t('admin.q.cancel')}</button>
          <button type="button" className="btn" onClick={save} disabled={busy}>
            {busy ? t('common.loading') : t('admin.reading.saveAndNext')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ReadingPassages({ subjectId, section, passages, onChanged, onError }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const [upload, setUpload] = useState(null);
  const newPath = contentPath(subjectId, section.id, 'reading', 'new');

  async function chooseFile() {
    const file = await pickTextFile();
    if (!file) return;
    try {
      const raw = await readTextFile(file);
      if (!raw) { onError(t('admin.reading.errBody')); return; }
      const split = splitTitle(raw);
      setUpload({ file: file.name, initial: { title: split.title, subtitle: '', body: split.body } });
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="card admin-reading">
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <span className="badge brand">{t('reading.cardBadge')}</span>
          <h2 style={{ margin: '8px 0 4px' }}>{t('admin.reading.title')}</h2>
          <p className="muted" style={{ margin: 0 }}>{t('admin.reading.lead')}</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={chooseFile}>{t('admin.reading.upload')}</button>
          <Link className="btn ghost" to={newPath}>{t('admin.reading.write')}</Link>
        </div>
      </div>
      {upload && (
        <PassageUploadPreview
          file={upload.file}
          initial={upload.initial}
          testId={section.id}
          onClose={() => setUpload(null)}
          onCreated={(passage) => navigate(contentPath(subjectId, section.id, 'reading', passage.id))}
        />
      )}
      <div className="admin-list">
        {!passages.length && <div className="empty">{t('admin.reading.empty')}</div>}
        {passages.map((p, i) => (
          <div key={p.id} className={`admin-list-item${p.isActive ? '' : ' is-off'}`}>
            <span className="admin-reading-num">{String(i + 1).padStart(2, '0')}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{p.title}</h4>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {t('admin.reading.questions', { n: p.questionCount })}
                {p.subtitle ? ` · ${previewText(p.subtitle)}` : ''}
              </p>
            </div>
            <Link className="btn sm" to={contentPath(subjectId, section.id, 'reading', p.id)}>{t('admin.reading.edit')}</Link>
            <button
              className="btn ghost sm"
              type="button"
              onClick={async () => {
                if (!window.confirm(t('admin.reading.confirmRemove', { title: p.title }))) return;
                try {
                  await adminApi.deletePassage(p.id);
                  await onChanged(t('admin.saved'));
                } catch (err) {
                  onError(err.message);
                }
              }}
            >
              {t('admin.reading.remove')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionList({ questions, onEdit, onDelete }) {
  const { t } = useLang();
  return (
    <div className="admin-list">
      {!questions.length && <div className="empty">{t('admin.noQuestions')}</div>}
      {questions.map((q) => (
        <div key={q.id} className="admin-list-item">
          {q.imageUrl && <img className="admin-q-thumb" src={q.imageUrl} alt="" />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4>{previewText(q.text) || t('admin.q.imageOnly')}</h4>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {t('admin.answersCount', { n: (q.answers || []).length })}
            </p>
          </div>
          <button className="btn sm" type="button" onClick={() => onEdit(q)}>{t('admin.q.editShort')}</button>
          <button className="btn ghost sm" type="button" onClick={() => onDelete(q)}>{t('common.delete')}</button>
        </div>
      ))}
    </div>
  );
}

export default function AdminSection() {
  const { t } = useLang();
  const { subjectId, sectionId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [section, setSection] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [passages, setPassages] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [modal, setModal] = useState(null);

  async function reload() {
    const list = await loadSubjects();
    const foundSubject = list.find((row) => String(row.id) === String(subjectId));
    const foundSection = (foundSubject?.sections || [])
      .find((row) => String(row.id) === String(sectionId));
    if (!foundSubject || !foundSection) {
      navigate(foundSubject ? contentPath(foundSubject.id) : contentPath(), { replace: true });
      return;
    }
    setSubject(foundSubject);
    setSection(foundSection);
    if (sectionKind(foundSection) === 'group') {
      setQuestions([]);
      setPassages([]);
      return;
    }
    const [qs, ps] = await Promise.all([
      adminApi.questions(foundSection.id),
      adminApi.passages(foundSection.id),
    ]);
    setQuestions(qs.questions || []);
    setPassages(ps.passages || []);
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, [subjectId, sectionId]);

  async function done(ok, err) {
    if (err) {
      setMsg('');
      setError(err);
      return;
    }
    setError('');
    setMsg(ok);
    await reload();
  }

  async function run(fn) {
    try {
      await fn();
      await done(t('admin.saved'));
    } catch (err) {
      await done(null, err.message);
    }
  }

  async function removeQuestion(q) {
    if (!confirmDelete(t)) return;
    await run(() => adminApi.deleteQuestion(q.id));
  }

  if (!subject || !section) return <p className="muted">{t('common.loading')}</p>;

  const all = subject.sections || [];
  const chain = sectionChain(all, section.id);
  const kind = sectionKind(section);
  const isReading = kind === 'reading' || passages.length > 0;
  const compares = questions.filter(isCompare);
  const plainQuestions = questions.filter((q) => !isCompare(q));
  const children = all.filter((row) => row.parentId === section.id);
  const onChanged = (ok) => done(ok);
  const onError = (err) => done(null, err);

  const requireImage = kind === 'geometry';
  const canMix = kind === 'group' && children.some((row) => [...QUESTION_KINDS, 'compare'].includes(sectionKind(row)));
  const isQuestions = QUESTION_KINDS.includes(kind) && !isReading;
  let summary = t('admin.questionsCount', { n: plainQuestions.length });
  if (kind === 'group') summary = t('admin.subsectionsCount', { n: children.length });
  else if (kind === 'compare') summary = t('admin.cmp.count', { n: compares.length });
  else if (isReading) {
    summary = t('admin.reading.summary', { texts: passages.length, n: passages.reduce((s, p) => s + p.questionCount, 0) });
  }

  return (
    <div>
      <Crumbs items={[
        { label: t('admin.subjects'), to: contentPath() },
        { label: subject.name, to: contentPath(subject.id) },
        ...chain.map((row, i) => (i === chain.length - 1
          ? { label: row.name }
          : { label: row.name, to: contentPath(subject.id, row.id) })),
      ]} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <span className={`kind-badge kind-${kind}`}>{kindLabel(t, kind)}</span>
          <h1 style={{ marginTop: 8 }}>{section.name}</h1>
          <p className="muted">{summary}</p>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {kind === 'group' && canMix && <MixedUploadButton groupId={section.id} onDone={done} />}
          {kind === 'group' && (
            <button className={`btn${canMix ? ' ghost sm' : ''}`} type="button" onClick={() => setModal({ item: null })}>
              {t('admin.addSubsection')}
            </button>
          )}
          {isQuestions && (
            <>
              <button className="btn sm" type="button" onClick={() => setEditing(null)}>+ {t('admin.q.add')}</button>
              <TxtUploadButtons testId={section.id} requireImage={requireImage} onDone={done} />
            </>
          )}
        </div>
      </div>
      {isQuestions && (
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {t('admin.txtHint')}
          {requireImage && <> <b>{t('admin.geoHint')}</b></>}
        </p>
      )}
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      {canMix && (
        <details className="cmp-format">
          <summary>{t('admin.mixed.formatTitle')}</summary>
          <pre>{'"ID":"1" "Section":"Вычисления" "Q":"3/4 + 5/8" "A1":"1 1/8" "A2":"1 3/8" "Correct":"2" "E":"..."\n"ID":"2" "Section":"Геометрия" "Q":"Найдите площадь" "A1":"12" "A2":"24" "Correct":"2"\n"ID":"3" "A":"2^5" "B":"5^2" "Correct":"А"'}</pre>
          <p className="muted">{t('admin.mixed.formatHint')}</p>
        </details>
      )}
      {kind === 'group' && (
        <SectionList
          sections={children}
          all={all}
          emptyText={t('admin.noSubsections')}
          onOpen={(row) => navigate(contentPath(subject.id, row.id))}
          onEdit={(row) => setModal({ item: row })}
          onDelete={(row) => {
            if (!window.confirm(t('admin.confirmDeleteSection', { name: row.name }))) return;
            run(() => adminApi.deleteTest(row.id));
          }}
        />
      )}

      {isReading && (
        <>
          <ReadingPassages
            subjectId={subject.id}
            section={section}
            passages={passages}
            onChanged={onChanged}
            onError={onError}
          />
          <div className="admin-section-head">
            <div>
              <h3 style={{ margin: 0 }}>{t('admin.reading.looseTitle')}</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{t('admin.reading.looseLead')}</p>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn ghost sm" type="button" onClick={() => setEditing(null)}>+ {t('admin.q.add')}</button>
              <TxtUploadButtons testId={section.id} onDone={done} />
            </div>
          </div>
        </>
      )}

      {!isReading && (kind === 'compare' || compares.length > 0) && (
        <CompareBlock testId={section.id} questions={compares} onChanged={onChanged} onError={onError} />
      )}

      {kind !== 'group' && (kind !== 'compare' || plainQuestions.length > 0) && (
        <>
          {kind === 'compare' && (
            <div className="admin-section-head">
              <h3 style={{ margin: 0 }}>{t('admin.cmp.otherTitle')}</h3>
            </div>
          )}
          <QuestionList questions={plainQuestions} onEdit={setEditing} onDelete={removeQuestion} />
        </>
      )}

      {editing !== undefined && (
        <QuestionModal
          key={editing?.id || 'new'}
          testId={section.id}
          requireImage={requireImage}
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (ok) => {
            setEditing(undefined);
            await done(ok);
          }}
        />
      )}

      {modal && (
        <Modal title={modal.item ? t('common.edit') : t('admin.addSubsection')} onClose={() => setModal(null)}>
          <SectionForm
            initialName={modal.item?.name || ''}
            initialKind={modal.item ? sectionKind(modal.item) : 'standard'}
            showOrtPart={false}
            onClose={() => setModal(null)}
            onSubmit={(body) => run(async () => {
              if (modal.item) await adminApi.updateTest(modal.item.id, body);
              else await adminApi.createTest({ ...body, parentId: section.id });
              setModal(null);
            })}
          />
        </Modal>
      )}
    </div>
  );
}

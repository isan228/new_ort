import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { PassageText } from '../../components/PassageText';
import { findEvidence, splitParagraphs } from '../../lib/reading';
import { Crumbs, TxtUploadButtons, contentPath, previewText } from './adminUi';
import QuestionForm, { draftPayload, draftProblem, toDraft } from './QuestionForm';
import { pickTextFile, readTextFile, splitTitle } from '../../lib/textFile';
import '../../styles/reading-book.css';

function QuestionEditor({
  q,
  index,
  open,
  paragraphs,
  selection,
  onToggle,
  onChange,
  onSave,
  onRemove,
  busy,
  t,
}) {
  const [hint, setHint] = useState('');
  const ranges = useMemo(() => findEvidence(paragraphs, q.evidence), [paragraphs, q.evidence]);
  const problem = draftProblem(q);

  function takeSelection() {
    if (!selection) {
      setHint(t('admin.reading.qNoSelection'));
      return;
    }
    setHint('');
    onChange({ ...q, evidence: selection, dirty: true });
  }

  return (
    <div className={`ar-q${open ? ' open' : ''}${q.dirty ? ' dirty' : ''}`}>
      <button type="button" className="ar-q-head" onClick={onToggle}>
        <span className="ar-q-num">{index + 1}</span>
        {q.imageUrl && <img className="ar-q-thumb" src={q.imageUrl} alt="" />}
        <span className="ar-q-title">{previewText(q.text) || t('admin.reading.qText')}</span>
        {q.dirty && <span className="ar-q-dot" title={t('admin.reading.unsaved')} />}
        <span className="ar-q-chev" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="ar-q-body">
          <QuestionForm draft={q} onChange={onChange}>
            <div className="field" style={{ marginTop: 14 }}>
              <span>{t('admin.reading.qEvidence')}</span>
              <textarea rows={2} value={q.evidence} onChange={(e) => onChange({ ...q, evidence: e.target.value, dirty: true })} />
              <div className="ar-evidence-row">
                <button type="button" className="btn ghost sm" onClick={takeSelection}>
                  {t('admin.reading.qTakeSelection')}
                </button>
                {hint && <span className="field-error">{hint}</span>}
                {!hint && q.evidence.trim() && (ranges.length ? (
                  <span className="ar-ok">{t('admin.reading.qEvidenceOk', { n: ranges[0].index + 1 })}</span>
                ) : (
                  <span className="field-error">{t('admin.reading.qEvidenceMissing')}</span>
                ))}
              </div>
            </div>
          </QuestionForm>

          <div className="ar-q-actions">
            <button type="button" className="btn ghost sm" onClick={onRemove} disabled={busy}>
              {t('admin.reading.qRemove')}
            </button>
            <span className="ar-q-spacer" />
            {problem && q.dirty && <span className="field-error">{t(problem)}</span>}
            <button type="button" className="btn sm" onClick={onSave} disabled={busy || !!problem || !q.dirty}>
              {t('admin.reading.qSave')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminReadingEditor() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { subjectId, sectionId, passageId } = useParams();
  const isNew = passageId === 'new';

  const [subject, setSubject] = useState(null);
  const [section, setSection] = useState(null);
  const [form, setForm] = useState({ title: '', subtitle: '', body: '', isActive: true });
  const [savedForm, setSavedForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [openKey, setOpenKey] = useState(null);
  const [selection, setSelection] = useState('');
  const [editText, setEditText] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const markRef = useRef(null);
  const flashTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  useEffect(() => {
    let stop = false;
    (async () => {
      const list = (await adminApi.subjects()).subjects;
      const foundSubject = list.find((row) => String(row.id) === String(subjectId));
      const foundSection = (foundSubject?.sections || []).find((row) => String(row.id) === String(sectionId));
      if (stop) return;
      if (!foundSubject || !foundSection) {
        navigate(contentPath(), { replace: true });
        return;
      }
      setSubject(foundSubject);
      setSection(foundSection);
      if (isNew) {
        const empty = { title: '', subtitle: '', body: '', isActive: true };
        setForm(empty);
        setSavedForm(empty);
        setQuestions([]);
        return;
      }
      const data = await adminApi.passage(passageId);
      if (stop) return;
      const loaded = {
        title: data.passage.title || '',
        subtitle: data.passage.subtitle || '',
        body: data.passage.body || '',
        isActive: data.passage.isActive !== false,
      };
      setForm(loaded);
      setSavedForm(loaded);
      setQuestions((data.questions || []).map(toDraft));
    })().catch((err) => setError(err.message));
    return () => { stop = true; };
  }, [subjectId, sectionId, passageId]);

  const paragraphs = useMemo(() => splitParagraphs(form.body), [form.body]);
  const openQuestion = questions.find((q) => q._key === openKey);
  const ranges = useMemo(
    () => (openQuestion ? findEvidence(paragraphs, openQuestion.evidence) : []),
    [openQuestion, paragraphs],
  );
  const formDirty = savedForm && JSON.stringify(form) !== JSON.stringify(savedForm);
  const anyDirty = formDirty || questions.some((q) => q.dirty);

  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  useEffect(() => {
    if (ranges.length) markRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ranges]);

  function flash(ok) {
    setError('');
    setMsg(ok);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setMsg(''), 2500);
  }

  async function reloadQuestions() {
    const data = await adminApi.passage(passageId);
    setQuestions((data.questions || []).map(toDraft));
  }

  async function loadBodyFromFile() {
    const file = await pickTextFile();
    if (!file) return;
    if (form.body.trim() && !window.confirm(t('admin.reading.replaceBody'))) return;
    try {
      const raw = await readTextFile(file);
      const split = form.title.trim() ? { title: form.title, body: raw } : splitTitle(raw);
      setForm({ ...form, title: split.title || form.title, body: split.body });
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePassage() {
    if (!form.title.trim()) { setError(t('admin.reading.errTitle')); return; }
    if (!paragraphs.length) { setError(t('admin.reading.errBody')); return; }
    setBusy(true);
    try {
      if (isNew) {
        const { passage } = await adminApi.createPassage({ ...form, testId: section.id });
        setSavedForm(form);
        navigate(contentPath(subject.id, section.id, 'reading', passage.id), { replace: true });
      } else {
        const { passage } = await adminApi.updatePassage(passageId, form);
        const next = { ...form, body: passage.body };
        setForm(next);
        setSavedForm(next);
        setEditText(false);
      }
      flash(t('admin.reading.saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateQuestion(next) {
    setQuestions((list) => list.map((q) => (q._key === next._key ? next : q)));
  }

  async function saveQuestion(q) {
    setBusy(true);
    try {
      const body = draftPayload(q);
      const order = questions.findIndex((row) => row._key === q._key) + 1;
      const res = q.id
        ? await adminApi.updateQuestion(q.id, { ...body, sortOrder: order })
        : await adminApi.createQuestion({ ...body, passageId: Number(passageId), sortOrder: order });
      updateQuestion({ ...toDraft(res.question), _key: q._key });
      flash(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(q) {
    if (!window.confirm(t('admin.reading.qConfirmRemove'))) return;
    if (q.id) {
      setBusy(true);
      try {
        await adminApi.deleteQuestion(q.id);
      } catch (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setQuestions((list) => list.filter((row) => row._key !== q._key));
    if (openKey === q._key) setOpenKey(null);
  }

  function addQuestion() {
    const q = toDraft(null);
    setQuestions((list) => [...list, q]);
    setOpenKey(q._key);
  }

  function captureSelection(e) {
    const sel = window.getSelection();
    const text = sel ? sel.toString().replace(/\s+/g, ' ').trim() : '';
    if (text && e.currentTarget.contains(sel.anchorNode)) setSelection(text);
  }

  if (!subject || !section) return <p className="muted">{error || t('common.loading')}</p>;

  const title = isNew ? t('admin.reading.newTitle') : (savedForm?.title || t('admin.reading.passage'));

  return (
    <div className="ar">
      <Crumbs items={[
        { label: t('admin.subjects'), to: contentPath() },
        { label: subject.name, to: contentPath(subject.id) },
        { label: section.name, to: contentPath(subject.id, section.id) },
        { label: title },
      ]} />

      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {formDirty ? t('admin.reading.unsaved') : t('admin.reading.questions', { n: questions.filter((q) => q.id).length })}
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={() => navigate(contentPath(subject.id, section.id))}>
            {t('admin.reading.back')}
          </button>
          {(isNew || formDirty) && (
            <button type="button" className="btn" onClick={savePassage} disabled={busy}>
              {isNew ? t('admin.reading.saveAndNext') : t('admin.reading.save')}
            </button>
          )}
        </div>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      <div className="ar-grid">
        <div className="ar-col">
          {!isNew && (
            <div className="ar-text-bar">
              <span className="muted">{t('admin.reading.textBar')}</span>
              <button type="button" className={`btn sm${editText ? '' : ' ghost'}`} onClick={() => setEditText(!editText)}>
                {editText ? t('admin.reading.hideEdit') : t('admin.reading.editText')}
              </button>
            </div>
          )}
          {editText && (
          <div className="card ar-form">
            <label className="field">
              <span>{t('admin.reading.fTitle')}</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('admin.reading.fSubtitle')}</span>
              <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </label>
            <div className="field">
              <div className="ar-body-head">
                <span>{t('admin.reading.fBody')}</span>
                <button type="button" className="btn ghost sm" onClick={loadBodyFromFile}>
                  {t('admin.reading.loadFile')}
                </button>
              </div>
              <textarea
                className="ar-body"
                rows={12}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <small className="field-hint">{t('admin.reading.bodyHint')}</small>
            </div>
            <label className="ar-check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>{t('admin.reading.active')}</span>
            </label>
            {!isNew && (
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn" onClick={savePassage} disabled={busy || !formDirty}>
                  {t('admin.reading.save')}
                </button>
              </div>
            )}
          </div>
          )}

          {isNew && (
            <div className="ar-preview-head">
              <b>{t('admin.reading.preview')}</b>
              <span className="muted">{t('admin.reading.previewHintNew')}</span>
            </div>
          )}
          <div className="rb rb-embed theme-light measure-normal">
            <div className="rb-page rb-left">
              <PassageText
                passage={{ title: form.title, subtitle: form.subtitle, body: form.body }}
                number={1}
                pageNo={1}
                ranges={ranges}
                markRef={markRef}
                onMouseUp={captureSelection}
                t={t}
              />
            </div>
          </div>
        </div>

        <div className="ar-col ar-questions">
          <div className="ar-q-top">
            <div>
              <h2>{t('admin.reading.qTitle')}</h2>
              {!isNew && <p className="muted ar-q-note">{t('admin.reading.qOnlyThis', { title: savedForm?.title || '' })}</p>}
            </div>
            {!isNew && (
              <button type="button" className="btn sm" onClick={addQuestion}>
                + {t('admin.reading.qAdd')}
              </button>
            )}
          </div>
          {isNew && (
            <ol className="ar-steps">
              <li className="on">{t('admin.reading.step1')}</li>
              <li>{t('admin.reading.step2')}</li>
            </ol>
          )}
          {!isNew && (
            <div className="ar-txt">
              <span className="muted">{t('admin.reading.qTxt')}</span>
              <TxtUploadButtons
                passageId={Number(passageId)}
                onDone={async (ok, err) => {
                  if (err) { setMsg(''); setError(err); return; }
                  flash(ok);
                  await reloadQuestions();
                }}
              />
            </div>
          )}
          {!isNew && !questions.length && <div className="empty">{t('admin.reading.qEmptyInside')}</div>}
          {questions.map((q, i) => (
            <QuestionEditor
              key={q._key}
              q={q}
              index={i}
              open={openKey === q._key}
              paragraphs={paragraphs}
              selection={selection}
              busy={busy}
              t={t}
              onToggle={() => setOpenKey(openKey === q._key ? null : q._key)}
              onChange={updateQuestion}
              onSave={() => saveQuestion(q)}
              onRemove={() => removeQuestion(q)}
            />
          ))}
          {selection && (
            <p className="ar-selection">
              <b>{t('admin.reading.qTakeSelection')}:</b> «{previewText(selection)}»
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

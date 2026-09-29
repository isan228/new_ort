import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

const LETTERS = 'ABCDEFGHIJ';

let keySeq = 0;
const nextKey = () => `k${Date.now()}-${keySeq++}`;

function withKeys(items) {
  return items.map((item) => ({
    ...item,
    tagsText: (item.tags || []).map((tag) => tag.name).join(', '),
    _key: nextKey(),
    answers: (item.answers || []).map((a) => ({ ...a, _key: nextKey() })),
  }));
}

function emptyQuestion() {
  return {
    _key: nextKey(),
    externalId: null,
    groupId: null,
    text: '',
    imageUrl: null,
    explanation: '',
    explanationImageUrl: null,
    answers: [0, 1, 2, 3].map((i) => ({ _key: nextKey(), text: '', imageUrl: null, isCorrect: i === 0 })),
    tags: [],
    tagsText: '',
  };
}

export function questionProblems(q) {
  const problems = [];
  if (!q.text.trim() && !q.imageUrl) problems.push('errText');
  const filled = q.answers.filter((a) => a.text.trim() || a.imageUrl);
  if (filled.length < 2) problems.push('errAnswers');
  if (!filled.some((a) => a.isCorrect)) problems.push('errCorrect');
  return problems;
}

function imageFromClipboard(event) {
  const item = [...(event.clipboardData?.items || [])].find((it) => it.type.startsWith('image/'));
  return item ? item.getAsFile() : null;
}

function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

function ImageSlot({ url, onChange, onUpload, compact = false }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  async function choose() {
    const file = await pickImage();
    if (!file) return;
    setBusy(true);
    try {
      onChange(await onUpload(file));
    } catch {
      /* error is shown by the preview */
    } finally {
      setBusy(false);
    }
  }

  if (url) {
    return (
      <div className={`tp-image ${compact ? 'compact' : ''}`}>
        <img src={url} alt="" />
        <div className="tp-image-actions">
          <button type="button" className="btn ghost sm" onClick={choose} disabled={busy}>{t('admin.preview.replaceImage')}</button>
          <button type="button" className="btn ghost sm" onClick={() => onChange(null)}>{t('admin.preview.removeImage')}</button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className={`tp-add-image ${compact ? 'compact' : ''}`} onClick={choose} disabled={busy}>
      {busy ? t('admin.preview.uploading') : t('admin.preview.addImage')}
    </button>
  );
}

function QuestionCard({ q, index, onChange, onRemove, onUpload }) {
  const { t } = useLang();
  const problems = questionProblems(q);

  function set(patch) {
    onChange({ ...q, ...patch });
  }

  function setAnswer(key, patch) {
    set({ answers: q.answers.map((a) => (a._key === key ? { ...a, ...patch } : a)) });
  }

  function markCorrect(key) {
    set({ answers: q.answers.map((a) => ({ ...a, isCorrect: a._key === key })) });
  }

  async function pasteInto(event, field) {
    const file = imageFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    try {
      set({ [field]: await onUpload(file) });
    } catch {
      /* error is shown by the preview */
    }
  }

  return (
    <article id={`tp-q-${q._key}`} className={`tp-card ${problems.length ? 'has-problems' : ''}`}>
      <header className="tp-card-head">
        <div className="tp-card-title">
          <b>{t('admin.preview.question', { n: index + 1 })}</b>
          {q.externalId && <span className="badge">ID {q.externalId}</span>}
          {q.groupId && <span className="badge brand">{t('admin.preview.group', { id: q.groupId })}</span>}
        </div>
        <button type="button" className="btn ghost sm tp-danger" onClick={onRemove}>{t('admin.preview.deleteQuestion')}</button>
      </header>

      {problems.length > 0 && (
        <div className="tp-problems">
          {problems.map((p) => <span key={p}>{t(`admin.preview.${p}`)}</span>)}
        </div>
      )}

      <label className="field">
        <span>{t('admin.preview.text')}</span>
        <textarea
          rows={Math.min(10, Math.max(3, Math.ceil(q.text.length / 90)))}
          value={q.text}
          onChange={(e) => set({ text: e.target.value })}
          onPaste={(e) => pasteInto(e, 'imageUrl')}
        />
      </label>
      <ImageSlot url={q.imageUrl} onChange={(url) => set({ imageUrl: url })} onUpload={onUpload} />

      <div className="tp-section-label">{t('admin.preview.answers')}</div>
      <div className="tp-answers">
        {q.answers.map((a, i) => (
          <div key={a._key} className={`tp-answer ${a.isCorrect ? 'is-correct' : ''}`}>
            <label className="tp-correct" title={t('admin.preview.correct')}>
              <input type="radio" name={`correct-${q._key}`} checked={!!a.isCorrect} onChange={() => markCorrect(a._key)} />
              <span>{LETTERS[i] || i + 1}</span>
            </label>
            <div className="tp-answer-body">
              <input
                value={a.text}
                placeholder={t('admin.preview.answerPh', { l: LETTERS[i] || i + 1 })}
                onChange={(e) => setAnswer(a._key, { text: e.target.value })}
                onPaste={async (e) => {
                  const file = imageFromClipboard(e);
                  if (!file) return;
                  e.preventDefault();
                  try {
                    setAnswer(a._key, { imageUrl: await onUpload(file) });
                  } catch {
                    /* error is shown by the preview */
                  }
                }}
              />
              <ImageSlot compact url={a.imageUrl} onChange={(url) => setAnswer(a._key, { imageUrl: url })} onUpload={onUpload} />
            </div>
            <button
              type="button"
              className="tp-icon-btn"
              aria-label={t('admin.preview.removeAnswer')}
              title={t('admin.preview.removeAnswer')}
              disabled={q.answers.length <= 2}
              onClick={() => set({ answers: q.answers.filter((x) => x._key !== a._key) })}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {q.answers.length < LETTERS.length && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => set({ answers: [...q.answers, { _key: nextKey(), text: '', imageUrl: null, isCorrect: false }] })}
        >
          {t('admin.preview.addAnswer')}
        </button>
      )}

      <label className="field" style={{ marginTop: 16 }}>
        <span>{t('admin.preview.explanation')}</span>
        <textarea
          rows={Math.min(10, Math.max(3, Math.ceil(q.explanation.length / 90)))}
          value={q.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          onPaste={(e) => pasteInto(e, 'explanationImageUrl')}
        />
      </label>
      <ImageSlot url={q.explanationImageUrl} onChange={(url) => set({ explanationImageUrl: url })} onUpload={onUpload} />

      <label className="field" style={{ marginTop: 16, marginBottom: 0 }}>
        <span>{t('admin.preview.tags')}</span>
        <input value={q.tagsText} onChange={(e) => set({ tagsText: e.target.value })} />
      </label>
    </article>
  );
}

export default function TxtPreview({ fileName, parsed, target, onClose, onSaved }) {
  const { t } = useLang();
  const [items, setItems] = useState(() => withKeys(parsed.items || []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = useRef(false);

  const invalid = useMemo(() => items.filter((q) => questionProblems(q).length), [items]);

  useEffect(() => {
    document.body.classList.add('tp-open');
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('tp-open');
      window.removeEventListener('keydown', onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(next) {
    dirty.current = true;
    setItems(next);
  }

  function requestClose() {
    if (dirty.current && !window.confirm(t('admin.preview.confirmClose'))) return;
    onClose();
  }

  async function upload(file) {
    setError('');
    try {
      const { url } = await adminApi.uploadImage(file);
      return url;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  function jumpTo(key) {
    document.getElementById(`tp-q-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function save() {
    if (invalid.length) {
      jumpTo(invalid[0]._key);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = items.map(({ _key, answers, tags, tagsText, ...rest }) => {
        const kinds = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag.kind]));
        return {
          ...rest,
          answers: answers.map(({ _key: k, ...a }) => a),
          tags: [...new Set(tagsText.split(',').map((name) => name.trim()).filter(Boolean))]
            .map((name) => ({ name, kind: kinds.get(name.toLowerCase()) || 'topic' })),
        };
      });
      const data = await adminApi.importQuestions(target, payload);
      onSaved(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tp-overlay" role="dialog" aria-modal="true">
      <header className="tp-top">
        <div className="tp-top-info">
          <h2>{t('admin.preview.title')}</h2>
          <p className="muted">
            {fileName} · {t('admin.preview.found', { n: items.length })}
            {parsed.skipped > 0 && <> · <span className="tp-warn">{t('admin.preview.skipped', { n: parsed.skipped })}</span></>}
          </p>
        </div>
        <div className="tp-top-actions">
          <button type="button" className="btn ghost" onClick={requestClose} disabled={busy}>{t('common.cancel')}</button>
          <button type="button" className="btn" onClick={save} disabled={busy || !items.length}>
            {busy ? t('admin.preview.saving') : t('admin.preview.save', { n: items.length })}
          </button>
        </div>
      </header>

      <div className="tp-body">
        <nav className="tp-nav" aria-label={t('admin.preview.title')}>
          {items.map((q, i) => (
            <button
              key={q._key}
              type="button"
              className={questionProblems(q).length ? 'bad' : ''}
              onClick={() => jumpTo(q._key)}
            >
              {i + 1}
            </button>
          ))}
        </nav>

        <main className="tp-main">
          {parsed.hint && <div className="tp-hint">{parsed.hint}</div>}
          {invalid.length > 0 && <div className="form-alert">{t('admin.preview.invalidN', { n: invalid.length })}</div>}
          {error && <div className="form-alert">{error}</div>}
          <p className="muted tp-paste-hint">{t('admin.preview.pasteHint')}</p>

          {items.map((q, i) => (
            <QuestionCard
              key={q._key}
              q={q}
              index={i}
              onUpload={upload}
              onChange={(next) => update(items.map((x) => (x._key === q._key ? next : x)))}
              onRemove={() => update(items.filter((x) => x._key !== q._key))}
            />
          ))}

          <button type="button" className="tp-add-question" onClick={() => update([...items, emptyQuestion()])}>
            {t('admin.preview.addQuestion')}
          </button>
        </main>
      </div>
    </div>
  );
}

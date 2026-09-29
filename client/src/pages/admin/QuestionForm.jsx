import { useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { LETTERS } from '../../lib/reading';
import { ImageSlot, imageFromClipboard } from './TxtPreview';

let seq = 0;
const nextKey = () => `qf${Date.now()}-${seq++}`;

export function toDraft(q) {
  if (!q) {
    return {
      _key: nextKey(),
      id: null,
      text: '',
      imageUrl: null,
      explanation: '',
      explanationImageUrl: null,
      evidence: '',
      tagsText: '',
      answers: [0, 1, 2, 3].map(() => ({ _key: nextKey(), text: '', imageUrl: null, isCorrect: false })),
      dirty: true,
    };
  }
  return {
    _key: `q-${q.id}`,
    id: q.id,
    text: q.text || '',
    imageUrl: q.imageUrl || null,
    explanation: q.explanation || '',
    explanationImageUrl: q.explanationImageUrl || null,
    evidence: q.evidence || '',
    tagsText: (q.tags || []).map((tag) => tag.name).join(', '),
    tagKinds: new Map((q.tags || []).map((tag) => [tag.name.toLowerCase(), tag.kind])),
    answers: (q.answers || []).map((a) => ({
      _key: nextKey(),
      text: a.text || '',
      imageUrl: a.imageUrl || null,
      isCorrect: !!a.isCorrect,
    })),
    dirty: false,
  };
}

export function draftProblem(q) {
  if (!q.text.trim() && !q.imageUrl) return 'admin.q.errText';
  const filled = q.answers.filter((a) => a.text.trim() || a.imageUrl);
  if (filled.length < 2) return 'admin.q.errAnswers';
  if (!filled.some((a) => a.isCorrect)) return 'admin.q.errCorrect';
  return '';
}

export function draftPayload(q, { withTags = false } = {}) {
  const payload = {
    text: q.text.trim() || ' ',
    imageUrl: q.imageUrl || null,
    explanation: q.explanation.trim(),
    explanationImageUrl: q.explanationImageUrl || null,
    evidence: q.evidence.trim(),
    answers: q.answers
      .filter((a) => a.text.trim() || a.imageUrl)
      .map((a, i) => ({ text: a.text.trim() || ' ', imageUrl: a.imageUrl || null, isCorrect: a.isCorrect, sortOrder: i + 1 })),
  };
  if (withTags) {
    payload.tags = q.tagsText
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, kind: q.tagKinds?.get(name.toLowerCase()) || 'topic' }));
  }
  return payload;
}

export default function QuestionForm({ draft: q, onChange, showTags = false, children }) {
  const { t } = useLang();
  const [error, setError] = useState('');

  function set(patch) {
    onChange({ ...q, ...patch, dirty: true });
  }

  function setAnswer(key, patch) {
    set({ answers: q.answers.map((a) => (a._key === key ? { ...a, ...patch } : a)) });
  }

  function markCorrect(key) {
    set({ answers: q.answers.map((a) => ({ ...a, isCorrect: a._key === key })) });
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

  async function paste(event, apply) {
    const file = imageFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    try {
      apply(await upload(file));
    } catch {
      /* shown above */
    }
  }

  return (
    <div className="qf">
      {error && <p className="err" style={{ margin: 0 }}>{error}</p>}

      <label className="field">
        <span>{t('admin.q.text')}</span>
        <textarea
          rows={Math.min(8, Math.max(3, Math.ceil(q.text.length / 80)))}
          value={q.text}
          onChange={(e) => set({ text: e.target.value })}
          onPaste={(e) => paste(e, (url) => set({ imageUrl: url }))}
        />
      </label>
      <div className="qf-image">
        <small className="muted">{t('admin.q.imageOptional')}</small>
        <ImageSlot url={q.imageUrl} onChange={(url) => set({ imageUrl: url })} onUpload={upload} compact />
      </div>

      <div className="qf-label">{t('admin.q.answers')}</div>
      <div className="qf-answers">
        {q.answers.map((a, i) => (
          <div key={a._key} className={`qf-answer${a.isCorrect ? ' is-correct' : ''}`}>
            <button
              type="button"
              className="qf-letter"
              title={t('admin.q.markCorrect')}
              onClick={() => markCorrect(a._key)}
            >
              {LETTERS[i] || i + 1}
            </button>
            <div className="qf-answer-body">
              <input
                value={a.text}
                placeholder={t('admin.q.answerPh', { l: LETTERS[i] || i + 1 })}
                onChange={(e) => setAnswer(a._key, { text: e.target.value })}
                onPaste={(e) => paste(e, (url) => setAnswer(a._key, { imageUrl: url }))}
              />
              <ImageSlot compact url={a.imageUrl} onChange={(url) => setAnswer(a._key, { imageUrl: url })} onUpload={upload} />
            </div>
            <button
              type="button"
              className="qf-remove"
              aria-label={t('common.delete')}
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
          className="btn ghost sm qf-add"
          onClick={() => set({ answers: [...q.answers, { _key: nextKey(), text: '', imageUrl: null, isCorrect: false }] })}
        >
          + {t('admin.q.addAnswer')}
        </button>
      )}

      <label className="field" style={{ marginTop: 14 }}>
        <span>{t('admin.q.explanation')}</span>
        <textarea
          rows={3}
          value={q.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          onPaste={(e) => paste(e, (url) => set({ explanationImageUrl: url }))}
        />
      </label>
      <div className="qf-image">
        <small className="muted">{t('admin.q.imageOptional')}</small>
        <ImageSlot compact url={q.explanationImageUrl} onChange={(url) => set({ explanationImageUrl: url })} onUpload={upload} />
      </div>

      {children}

      {showTags && (
        <label className="field" style={{ marginTop: 14, marginBottom: 0 }}>
          <span>{t('admin.q.tags')}</span>
          <input value={q.tagsText} onChange={(e) => set({ tagsText: e.target.value })} />
        </label>
      )}
      <p className="muted qf-hint">{t('admin.q.pasteHint')}</p>
    </div>
  );
}

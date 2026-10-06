import { useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { CompareColumns } from '../../components/QuestionStem';
import { COMPARE_LETTERS, compareCorrectLetter } from '../../lib/compare';
import { pickTextFile } from '../../lib/textFile';
import { Modal, confirmDelete, previewText } from './adminUi';
import { ImageSlot } from './TxtPreview';

function toDraft(q) {
  return {
    id: q?.id || null,
    text: q?.text?.trim() || '',
    compareA: q?.compareA || '',
    compareB: q?.compareB || '',
    correct: q ? compareCorrectLetter(q) : '',
    imageUrl: q?.imageUrl || null,
    explanation: q?.explanation || '',
    explanationImageUrl: q?.explanationImageUrl || null,
  };
}

function draftProblem(d) {
  if (!d.compareA.trim() || !d.compareB.trim()) return 'admin.cmp.errColumns';
  if (!d.correct) return 'admin.cmp.errCorrect';
  return '';
}

function draftPayload(d) {
  return {
    kind: 'compare',
    text: d.text.trim(),
    compareA: d.compareA.trim(),
    compareB: d.compareB.trim(),
    correct: d.correct,
    imageUrl: d.imageUrl || null,
    explanation: d.explanation.trim(),
    explanationImageUrl: d.explanationImageUrl || null,
  };
}

function CorrectPicker({ value, onChange }) {
  const { t } = useLang();
  return (
    <div className="cmp-pick" role="radiogroup">
      {COMPARE_LETTERS.map((letter, i) => (
        <button
          key={letter}
          type="button"
          role="radio"
          aria-checked={value === letter}
          className={`cmp-pick-opt${value === letter ? ' on' : ''}`}
          onClick={() => onChange(letter)}
        >
          <b>{letter}</b>
          <span>{t(`compare.answers.${i}`)}</span>
        </button>
      ))}
    </div>
  );
}

function CompareModal({ testId, initial, onClose, onSaved }) {
  const { t } = useLang();
  const [d, setD] = useState(() => toDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));

  async function upload(file) {
    try {
      const { url } = await adminApi.uploadImage(file);
      return url;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function save() {
    const problem = draftProblem(d);
    if (problem) { setError(t(problem)); return; }
    setBusy(true);
    setError('');
    try {
      if (d.id) await adminApi.updateQuestion(d.id, draftPayload(d));
      else await adminApi.createQuestion({ ...draftPayload(d), testId });
      await onSaved(t('admin.saved'));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={d.id ? t('admin.cmp.edit') : t('admin.cmp.new')} onClose={onClose}>
      <div className="qf">
        <label className="field">
          <span>{t('admin.cmp.condition')}</span>
          <textarea rows={2} value={d.text} placeholder={t('admin.cmp.conditionPh')} onChange={(e) => set({ text: e.target.value })} />
        </label>
        <div className="cmp-form-cols">
          <label className="field">
            <span>{t('compare.colA')}</span>
            <textarea rows={2} value={d.compareA} onChange={(e) => set({ compareA: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('compare.colB')}</span>
            <textarea rows={2} value={d.compareB} onChange={(e) => set({ compareB: e.target.value })} />
          </label>
        </div>
        <div className="qf-image">
          <small className="muted">{t('admin.q.imageOptional')}</small>
          <ImageSlot compact url={d.imageUrl} onChange={(url) => set({ imageUrl: url })} onUpload={upload} />
        </div>
        <div className="qf-label">{t('admin.cmp.correct')}</div>
        <CorrectPicker value={d.correct} onChange={(correct) => set({ correct })} />
        <label className="field" style={{ marginTop: 14 }}>
          <span>{t('admin.q.explanation')}</span>
          <textarea rows={3} value={d.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        </label>
        <div className="qf-image">
          <small className="muted">{t('admin.q.imageOptional')}</small>
          <ImageSlot compact url={d.explanationImageUrl} onChange={(url) => set({ explanationImageUrl: url })} onUpload={upload} />
        </div>
        {(d.compareA.trim() || d.compareB.trim()) && (
          <div className="cmp-preview">
            <div className="qf-label">{t('admin.cmp.preview')}</div>
            {d.text.trim() && <p style={{ margin: '0 0 8px' }}>{d.text}</p>}
            <CompareColumns a={d.compareA} b={d.compareB} />
          </div>
        )}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row qf-footer">
        <button type="button" className="btn ghost" onClick={onClose}>{t('admin.q.cancel')}</button>
        <button type="button" className="btn" onClick={save} disabled={busy}>
          {busy ? t('common.loading') : t('admin.q.save')}
        </button>
      </div>
    </Modal>
  );
}

function CompareTxtPreview({ testId, fileName, parsed, onClose, onSaved }) {
  const { t } = useLang();
  const [items, setItems] = useState(parsed.items);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const data = await adminApi.importQuestions({ testId }, items);
      await onSaved(data.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={t('admin.cmp.txtTitle', { n: items.length })} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        {fileName}
        {parsed.skipped ? ` · ${t('admin.cmp.skipped', { n: parsed.skipped })}` : ''}
      </p>
      {parsed.hint && <p className="err" style={{ marginTop: 0 }}>{parsed.hint}</p>}
      <div className="cmp-txt-list">
        {items.map((item, idx) => (
          <div key={`${item.externalId}-${idx}`} className="cmp-txt-item">
            <div className="cmp-txt-head">
              <b>№ {item.externalId}</b>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setItems((list) => list.filter((_, i) => i !== idx))}
              >
                {t('common.delete')}
              </button>
            </div>
            {item.text && <p style={{ margin: '0 0 8px' }}>{item.text}</p>}
            <CompareColumns a={item.compareA} b={item.compareB} />
            <div className="cmp-txt-correct">
              <span className="muted">{t('admin.cmp.correct')}:</span>
              {COMPARE_LETTERS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className={`cmp-letter${item.correct === letter ? ' on' : ''}`}
                  onClick={() => setItems((list) => list.map((row, i) => (i === idx ? { ...row, correct: letter } : row)))}
                >
                  {letter}
                </button>
              ))}
            </div>
            {item.explanation && <p className="muted cmp-txt-expl">{previewText(item.explanation)}</p>}
          </div>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="row qf-footer">
        <button type="button" className="btn ghost" onClick={onClose}>{t('admin.q.cancel')}</button>
        <button type="button" className="btn" onClick={save} disabled={busy || !items.length}>
          {busy ? t('common.loading') : t('admin.cmp.saveAll', { n: items.length })}
        </button>
      </div>
    </Modal>
  );
}

export default function CompareBlock({ testId, questions, onChanged, onError }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(undefined);
  const [txt, setTxt] = useState(null);
  const [busy, setBusy] = useState(false);

  async function uploadTxt() {
    const file = await pickTextFile();
    if (!file) return;
    setBusy(true);
    try {
      setTxt({ fileName: file.name, parsed: await adminApi.parseTxt(file, 'compare') });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card admin-compare">
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <span className="badge brand">{t('admin.cmp.badge')}</span>
          <h2 style={{ margin: '8px 0 4px' }}>{t('admin.cmp.title')}</h2>
          <p className="muted" style={{ margin: 0 }}>{t('admin.cmp.lead')}</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn sm" onClick={() => setEditing(null)}>+ {t('admin.cmp.add')}</button>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={uploadTxt}>
            {busy ? t('common.loading') : t('admin.cmp.upload')}
          </button>
        </div>
      </div>
      <details className="cmp-format">
        <summary>{t('admin.cmp.formatTitle')}</summary>
        <pre>{'"ID":"1" "Q":"x > 0" "A":"2^5" "B":"5^2" "Correct":"А" "E":"32 > 25"\n"ID":"2" "A":"0,5" "B":"1/2" "Correct":"В"'}</pre>
        <p className="muted">{t('admin.cmp.formatHint')}</p>
      </details>
      <div className="admin-list">
        {!questions.length && <div className="empty">{t('admin.cmp.empty')}</div>}
        {questions.map((q, i) => (
          <div key={q.id} className="admin-list-item">
            <span className="admin-reading-num">{String(i + 1).padStart(2, '0')}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4 className="cmp-row-title">
                <span>{t('admin.cmp.short', { a: previewText(q.compareA), b: previewText(q.compareB) })}</span>
                <span className="cmp-letter on">{compareCorrectLetter(q) || '?'}</span>
              </h4>
              {q.text?.trim() && <p className="muted" style={{ margin: '4px 0 0' }}>{previewText(q.text)}</p>}
            </div>
            <button className="btn sm" type="button" onClick={() => setEditing(q)}>{t('admin.q.editShort')}</button>
            <button
              className="btn ghost sm"
              type="button"
              onClick={async () => {
                if (!confirmDelete(t)) return;
                try {
                  await adminApi.deleteQuestion(q.id);
                  await onChanged(t('admin.saved'));
                } catch (err) {
                  onError(err.message);
                }
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
      {editing !== undefined && (
        <CompareModal
          key={editing?.id || 'new'}
          testId={testId}
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (ok) => { setEditing(undefined); await onChanged(ok); }}
        />
      )}
      {txt && (
        <CompareTxtPreview
          testId={testId}
          fileName={txt.fileName}
          parsed={txt.parsed}
          onClose={() => setTxt(null)}
          onSaved={async (ok) => { setTxt(null); await onChanged(ok); }}
        />
      )}
    </div>
  );
}

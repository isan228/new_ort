import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { CompareColumns } from '../../components/QuestionStem';
import { COMPARE_LETTERS } from '../../lib/compare';
import { pickTextFile } from '../../lib/textFile';
import { QuestionCard, questionProblems, withKeys } from './TxtPreview';
import { kindLabel } from './adminUi';

function isCompareItem(item) {
  return item.kind === 'compare';
}

function itemProblems(item, section) {
  if (!section) return ['errSection'];
  if (isCompareItem(item)) {
    const problems = [];
    if (!item.compareA?.trim() || !item.compareB?.trim()) problems.push('errColumns');
    if (!item.correct) problems.push('errCorrect');
    return problems;
  }
  return questionProblems(item, { requireImage: section.kind === 'geometry' });
}

function SectionPicker({ item, sections, onChange }) {
  const { t } = useLang();
  const options = sections.filter((row) => (isCompareItem(item) ? row.kind === 'compare' : row.kind !== 'compare'));
  return (
    <label className="field mx-section">
      <span>{t('admin.mixed.section')}</span>
      <select value={item.targetId || ''} onChange={(e) => onChange(Number(e.target.value) || null)}>
        <option value="">{t('admin.mixed.choose')}</option>
        {options.map((row) => (
          <option key={row.id} value={row.id}>{row.name} · {kindLabel(t, row.kind)}</option>
        ))}
      </select>
    </label>
  );
}

function CompareCard({ item, index, sections, onChange, onRemove }) {
  const { t } = useLang();
  const problems = itemProblems(item, sections.find((row) => row.id === item.targetId));
  return (
    <article id={`tp-q-${item._key}`} className={`tp-card ${problems.length ? 'has-problems' : ''}`}>
      <header className="tp-card-head">
        <div className="tp-card-title">
          <b>{t('admin.preview.question', { n: index + 1 })}</b>
          {item.externalId && <span className="badge">ID {item.externalId}</span>}
          <span className="badge brand">{t('admin.kinds.compare')}</span>
        </div>
        <button type="button" className="btn ghost sm tp-danger" onClick={onRemove}>{t('admin.preview.deleteQuestion')}</button>
      </header>
      <SectionPicker item={item} sections={sections} onChange={(targetId) => onChange({ ...item, targetId })} />
      {problems.length > 0 && (
        <div className="tp-problems">
          {problems.map((p) => <span key={p}>{t(`admin.mixed.${p}`)}</span>)}
        </div>
      )}
      {item.text && <p style={{ margin: '0 0 8px' }}>{item.text}</p>}
      <CompareColumns a={item.compareA} b={item.compareB} />
      <div className="cmp-txt-correct">
        <span className="muted">{t('admin.cmp.correct')}:</span>
        {COMPARE_LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`cmp-letter${item.correct === letter ? ' on' : ''}`}
            onClick={() => onChange({ ...item, correct: letter })}
          >
            {letter}
          </button>
        ))}
      </div>
      {item.explanation && <p className="muted cmp-txt-expl">{item.explanation}</p>}
    </article>
  );
}

function toPayload(item) {
  if (isCompareItem(item)) {
    const { kind, externalId, text, compareA, compareB, correct, explanation, imageUrl, explanationImageUrl } = item;
    return { kind, externalId, text, compareA, compareB, correct, explanation, imageUrl, explanationImageUrl };
  }
  const { _key, answers, targetId, sectionRaw, ...rest } = item;
  return { ...rest, answers: answers.map(({ _key: k, ...a }) => a) };
}

export function MixedPreview({ fileName, parsed, onClose, onSaved }) {
  const { t } = useLang();
  const { sections } = parsed;
  const [items, setItems] = useState(() => withKeys(parsed.items || []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = useRef(false);

  const sectionOf = (item) => sections.find((row) => row.id === item.targetId);
  const problemsOf = (item) => itemProblems(item, sectionOf(item));
  const invalid = useMemo(() => items.filter((item) => problemsOf(item).length), [items]);
  const counts = sections
    .map((row) => ({ ...row, n: items.filter((item) => item.targetId === row.id).length }))
    .filter((row) => row.n > 0);

  useEffect(() => {
    document.body.classList.add('tp-open');
    return () => document.body.classList.remove('tp-open');
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
    const saved = [];
    try {
      for (const section of sections) {
        const batch = items.filter((item) => item.targetId === section.id);
        if (!batch.length) continue;
        await adminApi.importQuestions({ testId: section.id }, batch.map(toPayload));
        saved.push(section.id);
      }
      onSaved(t('admin.mixed.saved', {
        n: items.length,
        list: counts.map((row) => `${row.name} — ${row.n}`).join(', '),
      }));
    } catch (err) {
      if (saved.length) update(items.filter((item) => !saved.includes(item.targetId)));
      setError(saved.length ? `${t('admin.mixed.partial')} ${err.message}` : err.message);
    } finally {
      setBusy(false);
    }
  }

  function replace(item, next) {
    update(items.map((row) => (row._key === item._key ? next : row)));
  }

  return (
    <div className="tp-overlay" role="dialog" aria-modal="true">
      <header className="tp-top">
        <div className="tp-top-info">
          <h2>{t('admin.mixed.title')}</h2>
          <p className="muted">
            {fileName} · {counts.map((row) => `${row.name}: ${row.n}`).join(' · ') || t('admin.preview.found', { n: items.length })}
            {parsed.skipped > 0 && <> · <span className="tp-warn">{t('admin.preview.skipped', { n: parsed.skipped })}</span></>}
          </p>
        </div>
        <div className="tp-top-actions">
          <button type="button" className="btn ghost" onClick={requestClose} disabled={busy}>{t('common.cancel')}</button>
          <button type="button" className="btn" onClick={save} disabled={busy || !items.length}>
            {busy ? t('admin.preview.saving') : t('admin.mixed.save', { n: items.length })}
          </button>
        </div>
      </header>

      <div className="tp-body">
        <nav className="tp-nav" aria-label={t('admin.mixed.title')}>
          {items.map((item, i) => (
            <button key={item._key} type="button" className={problemsOf(item).length ? 'bad' : ''} onClick={() => jumpTo(item._key)}>
              {i + 1}
            </button>
          ))}
        </nav>

        <main className="tp-main">
          {parsed.hint && <div className="tp-hint">{parsed.hint}</div>}
          {invalid.length > 0 && <div className="form-alert">{t('admin.preview.invalidN', { n: invalid.length })}</div>}
          {error && <div className="form-alert">{error}</div>}
          <p className="muted tp-paste-hint">{t('admin.mixed.lead')}</p>

          {items.map((item, i) => (isCompareItem(item) ? (
            <CompareCard
              key={item._key}
              item={item}
              index={i}
              sections={sections}
              onChange={(next) => replace(item, next)}
              onRemove={() => update(items.filter((row) => row._key !== item._key))}
            />
          ) : (
            <QuestionCard
              key={item._key}
              q={item}
              index={i}
              requireImage={sectionOf(item)?.kind === 'geometry'}
              onUpload={upload}
              onChange={(next) => replace(item, next)}
              onRemove={() => update(items.filter((row) => row._key !== item._key))}
              extra={(
                <>
                  <SectionPicker item={item} sections={sections} onChange={(targetId) => replace(item, { ...item, targetId })} />
                  {!sectionOf(item) && <div className="tp-problems"><span>{t('admin.mixed.errSection')}</span></div>}
                </>
              )}
            />
          )))}
        </main>
      </div>
    </div>
  );
}

export default function MixedUploadButton({ groupId, onDone }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  async function choose() {
    const file = await pickTextFile();
    if (!file) return;
    setBusy(true);
    try {
      setPreview({ fileName: file.name, parsed: await adminApi.parseTxt(file, 'mixed', groupId) });
    } catch (err) {
      await onDone(null, err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn sm" type="button" disabled={busy} onClick={choose}>
        {busy ? t('common.loading') : t('admin.mixed.upload')}
      </button>
      {preview && (
        <MixedPreview
          fileName={preview.fileName}
          parsed={preview.parsed}
          onClose={() => setPreview(null)}
          onSaved={async (message) => {
            setPreview(null);
            await onDone(message);
          }}
        />
      )}
    </>
  );
}

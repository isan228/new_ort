import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { newUploadId } from '../../lib/textFile';
import { matchFiles } from '../../lib/topicFileMatch';
import { compareItemPayload, compareItemProblem } from './AdminCompare';
import { questionProblems } from './TxtPreview';

export const BULK_FORMATS = ['standard', 'geometry', 'compare'];

function pickTxtFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.multiple = true;
    input.onchange = () => resolve([...(input.files || [])]);
    input.click();
  });
}

const modeOf = (target) => (target?.format === 'compare' ? 'compare' : 'explained');

function invalidCount(items, target) {
  if (target.format === 'compare') return items.filter((item) => compareItemProblem(item)).length;
  return items.filter((q) => questionProblems(q, { requireImage: target.format === 'geometry' }).length).length;
}

function payloadOf(items, target) {
  return target.format === 'compare' ? items.map(compareItemPayload) : items;
}

// Many TXT files at once: each file goes into the topic with the same name ("Fonetika.txt" → «Фонетика»).
// targets: [{ key, testId, name, label, format }].
export default function BulkTopicUpload({ targets, onDone }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const byKey = new Map(targets.map((target) => [target.key, target]));

  async function parseRow(row, targetKey) {
    const target = byKey.get(targetKey);
    if (!target) return { ...row, targetKey, status: 'skip', parsed: null, message: '' };
    const mode = modeOf(target);
    const parsed = row.parsed && row.mode === mode ? row.parsed : await adminApi.parseTxt(row.file, mode).catch((err) => ({ error: err.message }));
    if (parsed.error) return { ...row, targetKey, mode, parsed: null, status: 'error', message: parsed.error };
    const items = parsed.items || [];
    if (!items.length) return { ...row, targetKey, mode, parsed, status: 'error', message: parsed.hint || t('admin.bulkUpload.empty') };
    const bad = invalidCount(items, target);
    if (bad) return { ...row, targetKey, mode, parsed, status: 'invalid', message: t('admin.bulkUpload.invalid', { n: bad }) };
    const found = t('admin.bulkUpload.found', { n: items.length });
    const message = parsed.skipped ? `${found} · ${t('admin.bulkUpload.skipped', { n: parsed.skipped })}` : found;
    return { ...row, targetKey, mode, parsed, status: 'ready', message };
  }

  async function choose() {
    const files = await pickTxtFiles();
    if (!files.length) return;
    const matches = matchFiles(files.map((f) => f.name), targets);
    const initial = files.map((file, i) => ({
      id: `${i}-${file.name}`,
      file,
      matches: matches[i],
      targetKey: matches[i].length === 1 ? matches[i][0].key : '',
      status: 'parsing',
    }));
    setRows(initial);
    setBusy(true);
    for (const row of initial) {
      const parsed = await parseRow(row, row.targetKey);
      setRows((list) => list.map((r) => (r.id === row.id ? parsed : r)));
    }
    setBusy(false);
  }

  async function retarget(row, targetKey) {
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, targetKey, status: 'parsing' } : r)));
    const parsed = await parseRow(row, targetKey);
    setRows((list) => list.map((r) => (r.id === row.id ? parsed : r)));
  }

  async function uploadAll() {
    setBusy(true);
    let files = 0;
    let questions = 0;
    let failed = 0;
    for (const row of rows.filter((r) => r.status === 'ready')) {
      const target = byKey.get(row.targetKey);
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: 'saving' } : r)));
      try {
        const items = row.parsed.items;
        await adminApi.importQuestions({ testId: target.testId }, payloadOf(items, target), { fileName: row.file.name, uploadId: newUploadId() });
        files += 1;
        questions += items.length;
        setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: 'done', message: t('admin.bulkUpload.saved', { n: items.length }) } : r)));
      } catch (err) {
        failed += 1;
        setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: 'error', message: err.message } : r)));
      }
    }
    setBusy(false);
    if (files) await onDone(t('admin.bulkUpload.summary', { files, n: questions }));
    else if (failed) await onDone(null, t('admin.bulkUpload.nothingSaved'));
  }

  function close() {
    if (busy) return;
    setRows(null);
  }

  useEffect(() => {
    if (!rows) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!targets.length) return null;
  const ready = rows ? rows.filter((r) => r.status === 'ready').length : 0;
  const unmatched = rows ? rows.filter((r) => !r.targetKey).length : 0;

  return (
    <>
      <button className="btn sm" type="button" onClick={choose} title={t('admin.bulkUpload.hint')}>
        {t('admin.bulkUpload.button')}
      </button>
      {rows && (
        <div className="modal-back" onClick={close}>
          <div className="card admin-modal bulk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{t('admin.bulkUpload.title', { n: rows.length })}</h3>
              <button className="btn ghost sm" type="button" onClick={close} disabled={busy}>×</button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>{t('admin.bulkUpload.lead')}</p>
            {unmatched > 0 && <p className="tp-warn" style={{ marginTop: 0 }}>{t('admin.bulkUpload.unmatched', { n: unmatched })}</p>}
            <div className="bulk-list">
              {rows.map((row) => (
                <div key={row.id} className={`bulk-row is-${row.status}`}>
                  <div className="bulk-file" title={row.file.name}>{row.file.name}</div>
                  <select
                    value={row.targetKey}
                    disabled={busy || row.status === 'done'}
                    onChange={(e) => retarget(row, e.target.value)}
                  >
                    <option value="">{t('admin.bulkUpload.skip')}</option>
                    {row.matches.length > 1 && (
                      <optgroup label={t('admin.bulkUpload.candidates')}>
                        {row.matches.map((m) => <option key={`m-${m.key}`} value={m.key}>{m.label || m.name}</option>)}
                      </optgroup>
                    )}
                    <optgroup label={t('admin.bulkUpload.allTopics')}>
                      {targets.map((target) => <option key={target.key} value={target.key}>{target.label || target.name}</option>)}
                    </optgroup>
                  </select>
                  <div className="bulk-status">
                    {row.status === 'parsing' || row.status === 'saving' ? t('common.loading') : row.message}
                    {row.status === 'done' && ' ✓'}
                  </div>
                </div>
              ))}
            </div>
            <div className="row qf-footer">
              <button type="button" className="btn ghost" onClick={close} disabled={busy}>{t('admin.bulkUpload.close')}</button>
              <button type="button" className="btn" onClick={uploadAll} disabled={busy || !ready}>
                {busy ? t('common.loading') : t('admin.bulkUpload.uploadAll', { n: ready })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

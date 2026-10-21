import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import MathText from '../../components/MathText';
import { QuestionSnapshot } from './AdminEditors';
import { DifficultyBadge } from './DifficultyPicker';

const ACTIONS = ['create', 'update', 'delete', 'import'];
const PAGE_SIZE = 30;
const FIELDS = ['text', 'compareA', 'compareB', 'imageUrl', 'explanation', 'explanationImageUrl', 'evidence', 'difficulty'];
const IMAGE_FIELDS = ['imageUrl', 'explanationImageUrl'];

const norm = (v) => (v === undefined || v === '' ? null : v);

// Field-by-field difference between the stored "before" and "after" snapshots of a question.
export function questionDiff(before, after) {
  if (!before || !after) return [];
  const out = [];
  for (const key of FIELDS) {
    if (!(key in before) && !(key in after)) continue;
    const a = norm(before[key]);
    const b = norm(after[key]);
    if (a !== b) out.push({ key, before: a, after: b });
  }
  const answersA = before.answers || [];
  const answersB = after.answers || [];
  for (let i = 0; i < Math.max(answersA.length, answersB.length); i += 1) {
    const a = answersA[i] || null;
    const b = answersB[i] || null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ key: 'answer', index: i, before: a, after: b });
  }
  if (before.testId && after.testId && before.testId !== after.testId) out.push({ key: 'moved' });
  return out;
}

function DiffValue({ field, value }) {
  const { t } = useLang();
  if (value == null) return <span className="muted">{t('admin.ed.empty')}</span>;
  if (IMAGE_FIELDS.includes(field)) return <img src={value} alt="" className="act-snap-img" />;
  if (field === 'difficulty') return <DifficultyBadge value={value} />;
  if (field === 'answer') {
    return (
      <span>
        <MathText text={value.text || ''} />
        {value.imageUrl && <img src={value.imageUrl} alt="" className="act-snap-img" />}
        {value.isCorrect && <span className="act-correct"> ✓ {t('admin.ed.correct')}</span>}
      </span>
    );
  }
  return <MathText text={String(value)} />;
}

function QuestionDiff({ entry }) {
  const { t } = useLang();
  const [full, setFull] = useState(false);
  const d = entry.details || {};
  const changes = questionDiff(d.before, d.after);
  return (
    <div className="act-diff">
      {!changes.length && <p className="muted">{t('admin.ed.noChanges')}</p>}
      {changes.map((c, i) => (
        <div key={i} className="act-diff-row">
          <b className="act-diff-field">
            {c.key === 'answer' ? t('admin.ed.field.answer', { n: c.index + 1 }) : t(`admin.ed.field.${c.key}`)}
          </b>
          {c.key !== 'moved' && (
            <div className="act-diff-values">
              <div className="act-diff-old"><DiffValue field={c.key} value={c.before} /></div>
              <span className="act-diff-arrow">→</span>
              <div className="act-diff-new"><DiffValue field={c.key} value={c.after} /></div>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => setFull((v) => !v)}>
        {full ? t('admin.ed.hideFull') : t('admin.ed.showFull')}
      </button>
      {full && (
        <div className="act-snaps">
          <QuestionSnapshot q={d.before} label={t('admin.ed.before')} />
          <QuestionSnapshot q={d.after} label={t('admin.ed.after')} />
        </div>
      )}
    </div>
  );
}

function Status({ entry }) {
  const { t } = useLang();
  if (entry.entity !== 'question' || entry.exists == null || entry.action === 'delete') return null;
  return entry.exists
    ? <span className="ed-status ok">{t('admin.ed.status.exists')}</span>
    : <span className="ed-status gone">{t('admin.ed.status.deletedLater')}</span>;
}

function EntryCard({ entry, locale }) {
  const { t } = useLang();
  const [open, setOpen] = useState(entry.action === 'update');
  const d = entry.details || {};
  const isQuestion = entry.entity === 'question';
  const snapshot = entry.action === 'delete' ? d.before : d.after;
  return (
    <div className={`act-item act-${entry.action}`}>
      <button type="button" className="act-head" onClick={() => setOpen((v) => !v)}>
        <span className="act-main">
          <b><MathText text={entry.summary || ''} /></b>
          <span className="muted act-meta">
            {new Date(entry.createdAt).toLocaleString(locale)}
            {entry.place ? ` · ${entry.place}` : ''}
            {!isQuestion ? ` · ${t(`admin.ed.entity.${entry.entity}`)}` : ''}
            {snapshot?.externalId ? ` · ID ${snapshot.externalId}` : ''}
          </span>
        </span>
        <Status entry={entry} />
        <span className="act-toggle">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="act-body">
          {isQuestion && entry.action === 'update' && <QuestionDiff entry={entry} />}
          {isQuestion && entry.action !== 'update' && (
            <QuestionSnapshot q={snapshot} label={entry.action === 'delete' ? t('admin.ed.deletedCopy') : t('admin.ed.added')} />
          )}
          {!isQuestion && (
            <p className="muted">
              {d.before && <>{t('admin.ed.before')}: <b>{d.before.title || d.before.name}</b> </>}
              {d.after && <>{t('admin.ed.after')}: <b>{d.after.title || d.after.name}</b></>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function UploadCard({ upload, locale }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="act-item act-import">
      <button type="button" className="act-head" onClick={() => setOpen((v) => !v)}>
        <span className="act-main">
          <b>📄 {upload.fileName || t('admin.ed.noFileName')}</b>
          <span className="muted act-meta">
            {new Date(upload.at).toLocaleString(locale)} · {t('admin.ed.questionsN', { n: upload.total })}
          </span>
          <span className="act-meta">
            {upload.parts.map((p, i) => <span key={i} className="ed-part">{p.place || '—'}: {p.count}</span>)}
          </span>
        </span>
        {upload.remaining != null && (
          <span className={`ed-status ${upload.remaining === upload.total ? 'ok' : 'gone'}`}>
            {t('admin.ed.remaining', { n: upload.remaining, total: upload.total })}
          </span>
        )}
        <span className="act-toggle">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="act-body">
          {!upload.items.length && <p className="muted">{upload.parts.map((p) => p.message).filter(Boolean).join(' · ') || '—'}</p>}
          <ol className="act-import-list">
            {upload.items.map((item, i) => (
              <li key={i}>
                {item.externalId && <span className="muted">#{item.externalId} </span>}
                <MathText text={item.text || ''} />
                {item.difficulty ? <> <DifficultyBadge value={item.difficulty} /></> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function AdminEditorActivity() {
  const { id, action: rawAction } = useParams();
  const action = ACTIONS.includes(rawAction) ? rawAction : 'create';
  const { t, locale } = useLang();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setPage(1); }, [action]);

  useEffect(() => {
    adminApi.editors()
      .then((d) => setStats((d.editors || []).find((e) => String(e.id) === String(id))?.stats || null))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    setData(null);
    setError('');
    adminApi.editorActivity(id, { action, page, limit: PAGE_SIZE })
      .then(setData)
      .catch((err) => { setError(err.message); setData({ items: [], uploads: [], total: 0 }); });
  }, [id, action, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const list = action === 'import' ? data?.uploads || [] : data?.items || [];

  return (
    <div>
      <Link to="../.." relative="path" className="muted">← {t('admin.editors')}</Link>
      <div className="admin-section-head" style={{ marginTop: 8 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{data?.editor?.name || '…'} <span className="muted ed-login">@{data?.editor?.login}</span></h1>
          <p className="muted" style={{ margin: 0 }}>{t(`admin.ed.lead_${action}`)}</p>
        </div>
      </div>
      <div className="ed-tabs" role="tablist">
        {ACTIONS.map((a) => (
          <Link
            key={a}
            to={`../${a}`}
            relative="path"
            role="tab"
            aria-selected={a === action}
            className={`act-badge act-${a}${a === action ? ' is-active' : ''}`}
          >
            {t(`admin.ed.stat.${a}`)}{stats ? `: ${stats[a] || 0}` : ''}
          </Link>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      {data == null && <p className="muted">{t('common.loading')}</p>}
      {data && !list.length && <div className="empty">{t('admin.ed.noActivity')}</div>}
      <div className="act-list">
        {action === 'import'
          ? list.map((u) => <UploadCard key={u.key} upload={u} locale={locale} />)
          : list.map((entry) => <EntryCard key={entry.id} entry={entry} locale={locale} />)}
      </div>
      {pages > 1 && (
        <div className="row act-pager">
          <button className="btn ghost sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="muted">{page} / {pages}</span>
          <button className="btn ghost sm" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}

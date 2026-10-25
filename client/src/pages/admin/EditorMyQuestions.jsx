import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import MathText from '../../components/MathText';
import { compareCorrectLetter } from '../../lib/compare';
import { contentPath } from './adminUi';
import { QuestionModal } from './AdminSection';
import { CompareModal } from './AdminCompare';
import { DifficultyBadge } from './DifficultyPicker';

const PAGE_SIZE = 20;

function placeLink(q) {
  if (q.bank === 'simulation') {
    const root = contentPath().replace(/\/content$/, '');
    return q.passageId ? `${root}/sim/slot/${q.testId}/reading/${q.passageId}` : `${root}/sim/slot/${q.testId}`;
  }
  return q.passageId ? contentPath(q.subjectId, q.testId, 'reading', q.passageId) : contentPath(q.subjectId, q.testId);
}

function QuestionCard({ q, locale, onEdit, onDelete }) {
  const { t } = useLang();
  const isCompare = q.kind === 'compare';
  return (
    <div className="admin-list-item my-q">
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="muted my-q-meta">
          <Link to={placeLink(q)}>{q.place}</Link>
          {q.externalId ? ` · ID ${q.externalId}` : ''}
          {' · '}{new Date(q.createdAt).toLocaleDateString(locale)}
          {q.updatedAt && new Date(q.updatedAt) - new Date(q.createdAt) > 60000 ? ` · ${t('admin.mine.edited')} ${new Date(q.updatedAt).toLocaleDateString(locale)}` : ''}
          {' '}<DifficultyBadge value={q.difficulty} />
          {q.bank === 'simulation' && <span className="badge my-q-bank">{t('admin.ed.bank.simulation')}</span>}
        </p>
        {isCompare ? (
          <div className="my-q-text">
            {q.text && <p><MathText text={q.text} /></p>}
            <p>А: <MathText text={q.compareA || ''} /> · Б: <MathText text={q.compareB || ''} /> · <b>{compareCorrectLetter(q) || '?'}</b></p>
          </div>
        ) : (
          <>
            <div className="my-q-text">
              {q.imageUrl && <img className="admin-q-thumb" src={q.imageUrl} alt="" />}
              <MathText text={q.text || ''} />
            </div>
            <ol className="my-q-answers">
              {(q.answers || []).map((a) => (
                <li key={a.id} className={a.isCorrect ? 'ok' : ''}><MathText text={a.text || ''} />{a.isCorrect ? ' ✓' : ''}</li>
              ))}
            </ol>
          </>
        )}
      </div>
      <div className="row my-q-actions">
        <button className="btn sm" type="button" onClick={() => onEdit(q)}>{t('admin.q.editShort')}</button>
        <button className="btn ghost sm" type="button" onClick={() => onDelete(q)}>{t('common.delete')}</button>
      </div>
    </div>
  );
}

export default function EditorMyQuestions() {
  const { t, locale } = useLang();
  const { user } = useAuth();
  const [filter, setFilter] = useState({ testId: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => { setPage(1); setFilter((f) => ({ ...f, q: search.trim() })); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setError('');
    adminApi.myQuestions({ ...filter, page, limit: PAGE_SIZE })
      .then(setData)
      .catch((err) => { setError(err.message); setData({ items: [], total: 0, sections: [] }); });
  }, [filter, page, reload]);

  async function remove(q) {
    if (!window.confirm(t('admin.mine.confirmDelete'))) return;
    try {
      await adminApi.deleteQuestion(q.id);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saved(message) {
    setEditing(null);
    setNotice(message);
    setReload((n) => n + 1);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const totalAll = (data?.sections || []).reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.mine.title')}</h1>
          <p className="muted">{t('admin.mine.lead', { name: user?.name || '' })}</p>
        </div>
      </div>
      <div className="row my-q-filters">
        <select value={filter.testId} onChange={(e) => { setPage(1); setFilter((f) => ({ ...f, testId: e.target.value })); }}>
          <option value="">{t('admin.mine.allSections', { n: totalAll })}</option>
          {(data?.sections || []).map((s) => <option key={s.testId} value={s.testId}>{s.place} — {s.count}</option>)}
        </select>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.mine.search')} />
      </div>
      {user?.role === 'editor' && !(user.editorSubjectIds || []).length && <div className="form-alert">{t('admin.mine.noAccess')}</div>}
      {notice && <p className="ok-note">{notice}</p>}
      {error && <p className="err">{error}</p>}
      {data == null && <p className="muted">{t('common.loading')}</p>}
      {data && !data.items.length && <div className="empty">{filter.q || filter.testId ? t('admin.mine.nothingFound') : t('admin.mine.empty')}</div>}
      <div className="admin-list">
        {(data?.items || []).map((q) => (
          <QuestionCard key={q.id} q={q} locale={locale} onEdit={setEditing} onDelete={remove} />
        ))}
      </div>
      {pages > 1 && (
        <div className="row act-pager">
          <button className="btn ghost sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span className="muted">{page} / {pages}</span>
          <button className="btn ghost sm" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
      {editing && editing.kind === 'compare' && (
        <CompareModal testId={editing.testId} initial={editing} onClose={() => setEditing(null)} onSaved={saved} />
      )}
      {editing && editing.kind !== 'compare' && (
        <QuestionModal
          testId={editing.testId}
          initial={editing}
          requireImage={editing.sectionKind === 'geometry'}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}

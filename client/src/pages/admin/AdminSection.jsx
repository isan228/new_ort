import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, TxtUploadButtons, confirmDelete, contentPath, previewText } from './adminUi';

function ReadingPassages({ subjectId, section, passages, onChanged, onError }) {
  const { t } = useLang();
  const newPath = contentPath(subjectId, section.id, 'reading', 'new');

  return (
    <div className="card admin-reading">
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <span className="badge brand">{t('reading.cardBadge')}</span>
          <h2 style={{ margin: '8px 0 4px' }}>{t('admin.reading.title')}</h2>
          <p className="muted" style={{ margin: 0 }}>{t('admin.reading.lead')}</p>
        </div>
        <Link className="btn" to={newPath}>{t('admin.reading.add')}</Link>
      </div>
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

  async function reload() {
    const list = (await adminApi.subjects()).subjects;
    const foundSubject = list.find((row) => String(row.id) === String(subjectId));
    const foundSection = (foundSubject?.sections || foundSubject?.Tests || [])
      .find((row) => String(row.id) === String(sectionId));
    if (!foundSubject || !foundSection) {
      navigate(foundSubject ? contentPath(foundSubject.id) : contentPath(), { replace: true });
      return;
    }
    setSubject(foundSubject);
    setSection(foundSection);
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

  async function afterUpload(ok, err) {
    if (err) {
      setMsg('');
      setError(err);
      return;
    }
    setError('');
    setMsg(ok);
    await reload();
  }

  if (!subject || !section) return <p className="muted">{t('common.loading')}</p>;

  const isReading = section.ortPart === 'reading' || passages.length > 0;

  return (
    <div>
      <Crumbs items={[
        { label: t('admin.subjects'), to: contentPath() },
        { label: subject.name, to: contentPath(subject.id) },
        { label: section.name },
      ]} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{section.name}</h1>
          <p className="muted">{t('admin.questionsCount', { n: questions.length })}</p>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {!isReading && (
            <Link className="btn ghost" to={contentPath(subject.id, section.id, 'reading', 'new')}>
              {t('admin.reading.add')}
            </Link>
          )}
          <TxtUploadButtons testId={section.id} onDone={afterUpload} />
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t('admin.txtHint')}</p>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      {isReading && (
        <ReadingPassages
          subjectId={subject.id}
          section={section}
          passages={passages}
          onChanged={async (ok) => { setError(''); setMsg(ok); await reload(); }}
          onError={(err) => { setMsg(''); setError(err); }}
        />
      )}

      <div className="admin-list">
        {!questions.length && <div className="empty">{t('admin.noQuestions')}</div>}
        {questions.map((q) => (
          <div key={q.id} className="admin-list-item">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{previewText(q.text)}</h4>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {(q.tags || []).map((tag) => tag.name).join(', ') || t('admin.noTags')}
              </p>
            </div>
            <button
              className="btn ghost sm"
              type="button"
              onClick={async () => {
                if (!confirmDelete(t)) return;
                try {
                  await adminApi.deleteQuestion(q.id);
                  setMsg(t('admin.saved'));
                  setError('');
                  await reload();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

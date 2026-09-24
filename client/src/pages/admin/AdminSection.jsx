import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, TxtUploadButtons, confirmDelete, contentPath, previewText } from './adminUi';

export default function AdminSection() {
  const { t } = useLang();
  const { subjectId, sectionId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [section, setSection] = useState(null);
  const [questions, setQuestions] = useState([]);
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
    setQuestions((await adminApi.questions(foundSection.id)).questions || []);
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
        <TxtUploadButtons testId={section.id} onDone={afterUpload} />
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t('admin.txtHint')}</p>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

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

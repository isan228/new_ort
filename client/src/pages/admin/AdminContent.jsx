import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

const TRACKS = [
  { id: 'main', label: 'Основной' },
  { id: 'state_lang', label: 'Госязык' },
  { id: 'subject', label: 'Предметный' },
];

export default function AdminContent() {
  const { t } = useLang();
  const [subjects, setSubjects] = useState([]);
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [testId, setTestId] = useState('');
  const [msg, setMsg] = useState('');

  async function reload() {
    setSubjects((await adminApi.subjects()).subjects);
  }
  useEffect(() => { reload().catch((e) => setMsg(e.message)); }, []);
  useEffect(() => {
    if (!subjectId) { setTests([]); return; }
    adminApi.tests(subjectId).then((d) => setTests(d.tests));
  }, [subjectId]);
  useEffect(() => {
    if (!testId) { setQuestions([]); return; }
    adminApi.questions(testId).then((d) => setQuestions(d.questions));
  }, [testId]);

  async function upload(url, extra = {}) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const data = await adminApi.uploadTxt(url, testId, file, extra);
      setMsg(`Загружено: +${data.created}, обновлено ${data.updated}`);
      if (testId) setQuestions((await adminApi.questions(testId)).questions);
    };
    input.click();
  }

  return (
    <div>
      <h1>{t('admin.content')}</h1>
      {msg && <p className="ok">{msg}</p>}
      <div className="grid-2">
        <div className="card">
          <h3>Категории</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.target);
            await adminApi.createSubject({
              name: form.get('name'),
              description: form.get('description'),
              trackGroup: form.get('trackGroup'),
              language: form.get('language'),
            });
            e.target.reset();
            await reload();
          }}>
            <input name="name" placeholder="Название" required />
            <select name="trackGroup">{TRACKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <input name="description" placeholder="Описание" />
            <select name="language"><option value="ru">ru</option><option value="ky">ky</option></select>
            <button className="btn" type="submit">Добавить</button>
          </form>
          <ul>
            {subjects.map((s) => (
              <li key={s.id}>
                <button type="button" className="btn ghost sm" onClick={() => { setSubjectId(s.id); setTestId(''); }}>{s.name}</button>
                <button type="button" className="btn sm bad" onClick={async () => { await adminApi.deleteSubject(s.id); await reload(); }}>×</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Банки</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!subjectId) return;
            const form = new FormData(e.target);
            await adminApi.createTest({ subjectId, name: form.get('name') });
            e.target.reset();
            setTests((await adminApi.tests(subjectId)).tests);
          }}>
            <input name="name" placeholder="Название банка" required />
            <button className="btn" disabled={!subjectId} type="submit">Добавить тест</button>
          </form>
          <ul>
            {tests.map((t) => (
              <li key={t.id}>
                <button type="button" className="btn ghost sm" onClick={() => setTestId(t.id)}>{t.name}{Number(testId) === t.id ? ' ←' : ''}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Вопросы</h3>
        <div className="row">
          <button className="btn ghost" disabled={!testId} type="button" onClick={() => upload('/api/admin/upload-txt-explained')}>TXT с объяснениями</button>
          <button className="btn ghost" disabled={!testId} type="button" onClick={() => upload('/api/admin/upload-txt-linked')}>TXT связанные</button>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.target);
          await adminApi.createQuestion({
            testId,
            text: form.get('text'),
            explanation: form.get('explanation'),
            answers: [1, 2, 3, 4].map((i) => ({ text: form.get(`a${i}`), isCorrect: Number(form.get('correct')) === i })),
            tags: [form.get('topic') && { name: form.get('topic'), kind: 'topic' }, form.get('skill') && { name: form.get('skill'), kind: 'skill' }].filter(Boolean),
          });
          e.target.reset();
          setQuestions((await adminApi.questions(testId)).questions);
        }}>
          <textarea name="text" placeholder="Текст вопроса" required rows={3} />
          <input name="a1" placeholder="A1" required />
          <input name="a2" placeholder="A2" required />
          <input name="a3" placeholder="A3" />
          <input name="a4" placeholder="A4" />
          <input name="correct" type="number" min={1} max={4} defaultValue={1} />
          <textarea name="explanation" placeholder="Объяснение" />
          <input name="topic" placeholder="Тема" />
          <input name="skill" placeholder="Навык" />
          <button className="btn" disabled={!testId} type="submit">Добавить вопрос</button>
        </form>
        <ol>
          {questions.map((q) => (
            <li key={q.id}>{q.text.slice(0, 90)}
              <button type="button" onClick={async () => { await adminApi.deleteQuestion(q.id); setQuestions((await adminApi.questions(testId)).questions); }}>×</button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

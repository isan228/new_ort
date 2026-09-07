import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';

const TRACKS = [
  { id: 'main', label: 'Основной' },
  { id: 'state_lang', label: 'Госязык' },
  { id: 'subject', label: 'Предметный' },
];

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [tags, setTags] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [users, setUsers] = useState([]);
  const [terms, setTerms] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [testId, setTestId] = useState('');
  const [msg, setMsg] = useState('');

  async function reload() {
    const [s, p, t, sub, u, ti] = await Promise.all([
      adminApi.stats(),
      adminApi.plans(),
      adminApi.tags(),
      adminApi.subjects(),
      adminApi.users(),
      adminApi.termImages(),
    ]);
    setStats(s);
    setPlans(p.plans);
    setTags(t.tags);
    setSubjects(sub.subjects);
    setUsers(u.users);
    setTerms(ti.items);
  }

  useEffect(() => {
    reload().catch((e) => setMsg(e.message));
  }, []);

  useEffect(() => {
    if (!subjectId) {
      setTests([]);
      return;
    }
    adminApi.tests(subjectId).then((d) => setTests(d.tests));
  }, [subjectId]);

  useEffect(() => {
    if (!testId) {
      setQuestions([]);
      setFlashcards([]);
      return;
    }
    adminApi.questions(testId).then((d) => setQuestions(d.questions));
    adminApi.flashcards({ testId }).then((d) => setFlashcards(d.flashcards));
  }, [testId]);

  async function savePlans() {
    await adminApi.savePlans(plans);
    setMsg('Тарифы сохранены');
  }

  async function addSubject(e) {
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
  }

  async function addTest(e) {
    e.preventDefault();
    if (!subjectId) return;
    const form = new FormData(e.target);
    await adminApi.createTest({
      subjectId,
      name: form.get('name'),
      description: form.get('description'),
    });
    e.target.reset();
    const d = await adminApi.tests(subjectId);
    setTests(d.tests);
  }

  async function addQuestion(e) {
    e.preventDefault();
    if (!testId) return;
    const form = new FormData(e.target);
    await adminApi.createQuestion({
      testId,
      text: form.get('text'),
      explanation: form.get('explanation'),
      answers: [1, 2, 3, 4].map((i) => ({
        text: form.get(`a${i}`),
        isCorrect: Number(form.get('correct')) === i,
      })),
      tags: [
        form.get('topic') && { name: form.get('topic'), kind: 'topic' },
        form.get('skill') && { name: form.get('skill'), kind: 'skill' },
      ].filter(Boolean),
    });
    e.target.reset();
    const d = await adminApi.questions(testId);
    setQuestions(d.questions);
  }

  async function upload(url, extra = {}) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const data = await adminApi.uploadTxt(url, testId, file, extra);
      setMsg(`Загружено: +${data.created}, обновлено ${data.updated}`);
      if (testId) {
        setQuestions((await adminApi.questions(testId)).questions);
        setFlashcards((await adminApi.flashcards({ testId })).flashcards);
      }
    };
    input.click();
  }

  return (
    <div>
      <h1 className="serif">Админка ОРТ</h1>
      {msg && <p className="ok">{msg}</p>}
      <div className="admin-cols">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Статистика</h3>
            {stats && (
              <ul>
                <li>Ученики: {stats.users}</li>
                <li>Активные подписки: {stats.activeSubs}</li>
                <li>Оплат: {stats.paid}</li>
                <li>Предметы: {stats.subjects}</li>
                <li>Тесты: {stats.tests}</li>
                <li>Вопросы: {stats.questions}</li>
                <li>Карточки: {stats.flashcards}</li>
              </ul>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Тарифы</h3>
            {plans.map((plan, i) => (
              <div key={plan.id || i} className="grid-2">
                <input value={plan.title} onChange={(e) => {
                  const next = [...plans];
                  next[i] = { ...plan, title: e.target.value };
                  setPlans(next);
                }} />
                <input type="number" value={plan.price} onChange={(e) => {
                  const next = [...plans];
                  next[i] = { ...plan, price: Number(e.target.value) };
                  setPlans(next);
                }} />
              </div>
            ))}
            <button className="btn" type="button" onClick={savePlans}>Сохранить тарифы</button>
          </div>

          <details className="card collapse" style={{ marginBottom: 16 }}>
            <summary>Теги вопросов</summary>
            {tags.map((tag) => (
              <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{tag.name} · {tag.kind}</span>
                <button type="button" className="btn ghost" onClick={async () => {
                  await adminApi.deleteTag(tag.id);
                  setTags((await adminApi.tags()).tags);
                }}>удалить</button>
              </div>
            ))}
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.target);
              await adminApi.createTag({ name: form.get('name'), kind: form.get('kind') });
              e.target.reset();
              setTags((await adminApi.tags()).tags);
            }}>
              <input name="name" placeholder="Новый тег" required />
              <select name="kind"><option value="topic">тема</option><option value="skill">навык</option></select>
              <button className="btn" type="submit">+</button>
            </form>
          </details>

          <details className="card collapse" style={{ marginBottom: 16 }}>
            <summary>Глоссарий терминов</summary>
            {terms.map((item) => (
              <div key={item.id}>
                {item.title}
                <button type="button" onClick={async () => {
                  await adminApi.deleteTerm(item.id);
                  setTerms((await adminApi.termImages()).items);
                }}>×</button>
              </div>
            ))}
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.target);
              await adminApi.createTerm(form);
              e.target.reset();
              setTerms((await adminApi.termImages()).items);
            }}>
              <input name="title" placeholder="Название" required />
              <input name="keywords" placeholder="слова через запятую" />
              <input name="image" type="file" />
              <button className="btn" type="submit">Добавить</button>
            </form>
          </details>

          <details className="card collapse">
            <summary>Пользователи</summary>
            {users.map((u) => (
              <div key={u.id} style={{ marginBottom: 8 }}>
                <b>{u.name}</b> · {u.email}
                <div className="muted">до {u.subscriptionEndDate ? new Date(u.subscriptionEndDate).toLocaleDateString('ru-KG') : 'нет'}</div>
                <button type="button" className="btn ghost" onClick={async () => {
                  await adminApi.grant(u.id, 1);
                  setUsers((await adminApi.users()).users);
                }}>+1 месяц</button>
              </div>
            ))}
          </details>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Предметы ОРТ</h3>
            <form onSubmit={addSubject} className="grid-2">
              <input name="name" placeholder="Название" required />
              <select name="trackGroup">{TRACKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <input name="description" placeholder="Описание" />
              <select name="language">
                <option value="ru">ru</option>
                <option value="ky">ky</option>
                <option value="en">en</option>
              </select>
              <button className="btn" type="submit">Добавить предмет</button>
            </form>
            <ul>
              {subjects.map((s) => (
                <li key={s.id}>
                  <button type="button" className="link" onClick={() => { setSubjectId(s.id); setTestId(''); }}>
                    {s.name}
                  </button>
                  {' '}· {s.trackGroup}
                  <button type="button" onClick={async () => { await adminApi.deleteSubject(s.id); await reload(); }}> ×</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Тесты / банки</h3>
            {!subjectId && <p className="muted">Выберите предмет слева в списке.</p>}
            <form onSubmit={addTest}>
              <input name="name" placeholder="Название банка" required />
              <button className="btn" type="submit" disabled={!subjectId}>Добавить тест</button>
            </form>
            <ul>
              {tests.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setTestId(t.id)}>{t.name}</button>
                  {Number(testId) === t.id ? ' ←' : ''}
                  <button type="button" onClick={async () => {
                    await adminApi.deleteTest(t.id);
                    setTests((await adminApi.tests(subjectId)).tests);
                  }}> ×</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Вопросы</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button className="btn ghost" type="button" disabled={!testId} onClick={() => upload('/api/admin/upload-txt-explained')}>TXT с объяснениями</button>
              <button className="btn ghost" type="button" disabled={!testId} onClick={() => upload('/api/admin/upload-txt-linked')}>TXT связанные</button>
            </div>
            <form onSubmit={addQuestion}>
              <textarea name="text" placeholder="Текст вопроса" required rows={3} />
              <input name="a1" placeholder="A1" required />
              <input name="a2" placeholder="A2" required />
              <input name="a3" placeholder="A3" />
              <input name="a4" placeholder="A4" />
              <input name="correct" type="number" min={1} max={4} defaultValue={1} />
              <textarea name="explanation" placeholder="Объяснение" />
              <input name="topic" placeholder="Тема" />
              <input name="skill" placeholder="Навык" />
              <button className="btn" type="submit" disabled={!testId}>Добавить вопрос</button>
            </form>
            <ol>
              {questions.map((q) => (
                <li key={q.id}>
                  {q.text.slice(0, 80)}
                  <button type="button" onClick={async () => {
                    await adminApi.deleteQuestion(q.id);
                    setQuestions((await adminApi.questions(testId)).questions);
                  }}> ×</button>
                </li>
              ))}
            </ol>
          </div>

          <div className="card">
            <h3>Flashcards</h3>
            <button className="btn ghost" type="button" onClick={() => upload('/api/admin/upload-txt-flashcards', { trackGroup: 'main' })}>
              TXT flashcards
            </button>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.target);
              await adminApi.createFlashcard({
                testId: testId || null,
                trackGroup: form.get('trackGroup'),
                frontText: form.get('frontText'),
                backText: form.get('backText'),
                topic: form.get('topic'),
              });
              e.target.reset();
              setFlashcards((await adminApi.flashcards(testId ? { testId } : {})).flashcards);
            }}>
              <select name="trackGroup">{TRACKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <input name="frontText" placeholder="Лицо" required />
              <input name="backText" placeholder="Оборот" required />
              <input name="topic" placeholder="Тема колоды" />
              <button className="btn" type="submit">+ Flashcard</button>
            </form>
            <ul>
              {flashcards.map((c) => (
                <li key={c.id}>
                  {c.frontText.slice(0, 60)}
                  <button type="button" onClick={async () => {
                    await adminApi.deleteFlashcard(c.id);
                    setFlashcards((await adminApi.flashcards(testId ? { testId } : {})).flashcards);
                  }}> ×</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

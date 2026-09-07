import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';

const CATS = [
  { id: 'all', title: 'Все' },
  { id: 'main', title: 'Полный ОРТ / основной' },
  { id: 'state_lang', title: 'Кыргызский язык' },
  { id: 'subject', title: 'Предметные' },
];

const META = {
  'Математика (основной)': { difficulty: 'Средняя', time: '25 мин', avg: '72%' },
  'Аналогии и предложения': { difficulty: 'Сложная', time: '20 мин', avg: '61%' },
  'Чтение и понимание': { difficulty: 'Средняя', time: '30 мин', avg: '74%' },
  'Практическая грамматика': { difficulty: 'Лёгкая', time: '15 мин', avg: '81%' },
  'Химия': { difficulty: 'Сложная', time: '40 мин', avg: '68%' },
};

export default function Tests() {
  const [data, setData] = useState({ main: [], state_lang: [], subject: [] });
  const [cat, setCat] = useState('all');
  const [error, setError] = useState('');
  const { setBank } = useBank();
  const navigate = useNavigate();

  useEffect(() => {
    ortApi.dashboard()
      .then(setData)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
  }, [navigate]);

  const list = cat === 'all'
    ? [...(data.main || []), ...(data.state_lang || []), ...(data.subject || [])]
    : (data[cat] || []);

  function open(subject) {
    const test = (subject.Tests || subject.tests || [])[0];
    setBank({
      subjectId: subject.id,
      testId: test?.id || null,
      name: subject.name,
      testName: test?.name,
      trackGroup: subject.trackGroup,
    });
    navigate(test ? `/app/create?bank=${test.id}` : '/app/create');
  }

  return (
    <div>
      <h1>Тесты</h1>
      <p className="muted">Выбери банк и собери сессию: тема × навык, режим экзамена или тренировка.</p>
      <div className="tabs">
        {CATS.map((c) => (
          <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.title}</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="cards">
        {list.map((subject) => {
          const tests = subject.Tests || subject.tests || [];
          const meta = META[subject.name] || { difficulty: 'Средняя', time: '20 мин', avg: '—' };
          return (
            <div key={subject.id} className="card">
              <h3>{subject.name}</h3>
              <p className="muted">{subject.description}</p>
              <p className="muted">{tests.length ? 'Банк вопросов готов' : 'Банк пока пуст'} · {meta.time} · {meta.difficulty}</p>
              <p className="muted">Средний результат {meta.avg}</p>
              <button className="btn" type="button" onClick={() => open(subject)} disabled={!tests.length}>Начать тест</button>
            </div>
          );
        })}
      </div>
      {!list.length && <div className="empty">В этой категории пока нет банков.</div>}
    </div>
  );
}

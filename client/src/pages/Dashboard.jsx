import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';

const TRACKS = [
  { id: 'main', title: 'Основной тест', text: 'Математика, аналогии, чтение, грамматика. Обязателен для всех.' },
  { id: 'state_lang', title: 'Государственный язык', text: 'Обязательный кыргызский: лексика, грамматика, чтение.' },
  { id: 'subject', title: 'Предметные тесты', text: 'Химия, биология, физика, математика, история, языки.' },
];

export default function Dashboard() {
  const [data, setData] = useState({ main: [], state_lang: [], subject: [] });
  const [track, setTrack] = useState('main');
  const [error, setError] = useState('');
  const { setBank } = useBank();
  const navigate = useNavigate();

  useEffect(() => {
    ortApi.dashboard()
      .then(setData)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/subscriptions');
        else setError(err.message);
      });
  }, [navigate]);

  function openBank(subject) {
    const test = (subject.Tests || subject.tests || [])[0];
    if (!test) {
      setBank({ subjectId: subject.id, testId: null, name: subject.name, trackGroup: subject.trackGroup });
      navigate('/ort-home');
      return;
    }
    setBank({
      subjectId: subject.id,
      testId: test.id,
      name: subject.name,
      testName: test.name,
      trackGroup: subject.trackGroup,
    });
    navigate(`/ort-home?bank=${test.id}`);
  }

  const list = data[track] || [];

  return (
    <div>
      <h1 className="serif">Банки ОРТ</h1>
      <p className="muted">Выберите трек, затем банк. Подписка одна на весь раздел — не на отдельный предмет.</p>
      <div className="tabs">
        {TRACKS.map((t) => (
          <button key={t.id} type="button" className={track === t.id ? 'on' : ''} onClick={() => setTrack(t.id)}>
            {t.title}
          </button>
        ))}
      </div>
      <p className="muted">{TRACKS.find((t) => t.id === track)?.text}</p>
      {error && <p className="err">{error}</p>}
      <div className="bank-list">
        {list.map((subject) => {
          const tests = subject.Tests || subject.tests || [];
          return (
            <button key={subject.id} type="button" className="card bank-card" onClick={() => openBank(subject)}>
              <h3>{subject.name}</h3>
              <p>{subject.description}</p>
              <p style={{ marginTop: 10 }}>{tests.length ? `${tests.length} банк(а) вопросов` : 'Банк пока пуст'}</p>
            </button>
          );
        })}
        {!list.length && <p className="muted">В этом треке пока нет предметов.</p>}
      </div>
    </div>
  );
}

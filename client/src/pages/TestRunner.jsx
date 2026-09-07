import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { glossaryApi, ortApi } from '../api/client';
import { linkifyMedicalTerms } from '../lib/linkify';
import { useBank } from '../context/BankContext';

export default function TestRunner() {
  const { bank } = useBank();
  const navigate = useNavigate();
  const session = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('ortSession') || 'null');
    } catch {
      return null;
    }
  }, []);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const [result, setResult] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [term, setTerm] = useState(null);

  useEffect(() => {
    glossaryApi.keywords().then((d) => setKeywords(d.keywords || [])).catch(() => {});
  }, []);

  if (!session?.questions?.length) {
    return <p>Сессия пуста. <Link to="/ort-create">Соберите тест</Link>.</p>;
  }

  const questions = session.questions;
  const q = questions[index];
  const groupMates = questions.filter((item) => q.groupId && item.groupId === q.groupId);
  const progress = ((index + 1) / questions.length) * 100;

  function choose(answerId) {
    setPicked((prev) => ({ ...prev, [q.id]: answerId }));
  }

  async function finish() {
    const answers = questions.map((item) => ({
      questionId: item.id,
      answerId: picked[item.id] || null,
    }));
    const data = await ortApi.check(session.test.id, {
      answers,
      questionMode: session.questionMode,
      durationSec: Math.round((Date.now() - session.startedAt) / 1000),
    });
    setResult(data);
  }

  if (result) {
    return (
      <div>
        <h1 className="serif">Результат: {result.score} / {result.total} ({result.accuracy}%)</h1>
        {result.items.map((item, i) => (
          <div key={item.questionId} className="card" style={{ marginBottom: 12 }}>
            <p className="muted">Вопрос {i + 1} · {item.correct ? 'верно' : 'ошибка'}</p>
            <p className="q-text">{item.question?.text}</p>
            <div className="answers">
              {(item.question?.answers || []).map((a) => (
                <div key={a.id} className={`answer ${a.isCorrect ? 'good' : ''} ${item.answerId === a.id && !a.isCorrect ? 'bad' : ''}`}>
                  {a.text}
                </div>
              ))}
            </div>
            {item.question?.explanation && (
              <p>
                {linkifyMedicalTerms(item.question.explanation, keywords, setTerm)}
              </p>
            )}
          </div>
        ))}
        <Link className="btn" to="/ort-home">К банку</Link>
        {term && (
          <div className="modal-back" onClick={() => setTerm(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{term.title}</h3>
              {term.imageUrl && <img src={term.imageUrl} alt="" style={{ maxWidth: '100%' }} />}
              <p>{term.description}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const selected = picked[q.id];
  const showInstant = session.instantFeedbackMode && selected;

  return (
    <div>
      <p className="muted">{bank?.name} · вопрос {index + 1} из {questions.length}</p>
      <div className="progress"><i style={{ width: `${progress}%` }} /></div>
      {q.groupId && groupMates.length > 1 && (
        <p className="muted">Связанные вопросы по одному тексту: {groupMates.length} шт.</p>
      )}
      <p className="q-text">{q.text}</p>
      <div className="answers">
        {q.answers.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`answer ${selected === a.id ? 'on' : ''}`}
            onClick={() => choose(a.id)}
          >
            {a.text}
          </button>
        ))}
      </div>
      {showInstant && <p className="muted">Ответ зафиксирован. Разбор будет после сдачи — без спойлеров в условии.</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn ghost" type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Назад</button>
        {index < questions.length - 1 ? (
          <button className="btn" type="button" onClick={() => setIndex(index + 1)}>Дальше</button>
        ) : (
          <button className="btn" type="button" onClick={finish}>Сдать</button>
        )}
        <button className="btn ghost" type="button" onClick={() => navigate('/ort-home')}>Выйти</button>
      </div>
    </div>
  );
}

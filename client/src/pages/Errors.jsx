import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export default function Errors() {
  const result = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('ortResult') || 'null'); } catch { return null; }
  }, []);
  const wrong = (result?.items || []).filter((i) => !i.correct);

  return (
    <div>
      <h1>Разбор ошибок</h1>
      <p className="muted">Возвращайся к вопросам, которые решил неправильно.</p>
      {!wrong.length && (
        <div className="empty">
          Пока нет разбора. Пройди тест — ошибки появятся здесь.
          <div style={{ marginTop: 12 }}><Link className="btn" to="/app/tests">Начать тест</Link></div>
        </div>
      )}
      {wrong.map((item) => (
        <div key={item.questionId} className="card" style={{ marginBottom: 12 }}>
          <p className="muted">Сложность: средняя · тема: практика</p>
          <p className="q-text" style={{ fontSize: 18 }}>{item.question?.text}</p>
          <p className="muted">Твой ответ: {(item.question?.answers || []).find((a) => a.id === item.answerId)?.text || 'пропуск'}</p>
          <p>Верный: {(item.question?.answers || []).find((a) => a.isCorrect)?.text}</p>
          {item.question?.explanation && <p className="muted">{item.question.explanation}</p>}
          <div className="row">
            <Link className="btn sm" to="/app/create">Повторить вопрос</Link>
            <Link className="btn ghost sm" to="/app/flashcards">Добавить во флеш-карты</Link>
            <Link className="btn ghost sm" to="/app/tests">Показать похожие вопросы</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

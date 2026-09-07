import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';

export default function TestBuilder() {
  const { bank } = useBank();
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [skills, setSkills] = useState([]);
  const [topicIds, setTopicIds] = useState([]);
  const [skillIds, setSkillIds] = useState([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [questionMode, setQuestionMode] = useState('all');
  const [examMode, setExamMode] = useState(false);
  const [randomizeAnswers, setRandomizeAnswers] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bank?.testId) return;
    ortApi.tagsGrouped(bank.testId)
      .then((data) => {
        setTopics(data.topics || []);
        setSkills(data.skills || []);
      })
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
  }, [bank, navigate]);

  function toggle(list, setList, id) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function start() {
    setError('');
    try {
      const data = await ortApi.customTest({
        testId: bank.testId,
        topicTagIds: topicIds,
        skillTagIds: skillIds,
        questionCount,
        questionMode,
        randomizeAnswers,
        instantFeedbackMode: !examMode,
      });
      sessionStorage.setItem('ortSession', JSON.stringify({
        ...data,
        examMode,
        instantFeedbackMode: !examMode,
        startedAt: Date.now(),
        questionMode,
        minutes: Math.max(8, questionCount * 1.2),
      }));
      navigate('/app/test');
    } catch (err) {
      if (isOrtGate(err)) navigate('/app/premium');
      else setError(err.message);
    }
  }

  if (!bank?.testId) {
    return <p>Выберите банк на странице <Link to="/app/tests">Тесты</Link>.</p>;
  }

  return (
    <div>
      <h1>Собрать тест</h1>
      <p className="muted">{bank.name}. Тема и навык пересекаются. В режиме экзамена ответы не показываются до конца.</p>
      <h3>Темы</h3>
      <div className="row" style={{ marginBottom: 12 }}>
        {topics.map((t) => (
          <button key={t.id} type="button" className={`chip ${topicIds.includes(t.id) ? 'on' : ''}`} onClick={() => toggle(topicIds, setTopicIds, t.id)}>
            {t.name} ({t.count})
          </button>
        ))}
        {!topics.length && <span className="muted">Теги появятся после загрузки вопросов</span>}
      </div>
      <h3>Тип задания</h3>
      <div className="row" style={{ marginBottom: 16 }}>
        {skills.map((t) => (
          <button key={t.id} type="button" className={`chip ${skillIds.includes(t.id) ? 'on' : ''}`} onClick={() => toggle(skillIds, setSkillIds, t.id)}>
            {t.name} ({t.count})
          </button>
        ))}
      </div>
      <div className="grid-3">
        <label className="field"><span>Число вопросов</span><input type="number" min={1} max={80} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} /></label>
        <label className="field">
          <span>Режим выборки</span>
          <select value={questionMode} onChange={(e) => setQuestionMode(e.target.value)}>
            <option value="all">Все</option>
            <option value="unsolved">Не решённые</option>
            <option value="incorrect">Ошибки</option>
          </select>
        </label>
        <label className="field">
          <span>Формат</span>
          <select value={examMode ? 'exam' : 'practice'} onChange={(e) => setExamMode(e.target.value === 'exam')}>
            <option value="practice">Тренировка</option>
            <option value="exam">Режим экзамена</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span><input type="checkbox" checked={randomizeAnswers} onChange={(e) => setRandomizeAnswers(e.target.checked)} /> Перемешать варианты</span>
      </label>
      {error && <p className="err">{error}</p>}
      <button className="btn lg" type="button" onClick={start}>Начать тест</button>
    </div>
  );
}

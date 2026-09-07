import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';

export default function TestBuilder() {
  const { bank } = useBank();
  const { t } = useLang();
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
    return <p>{t('builder.pick')} <Link to="/app/tests">{t('tests.title')}</Link>.</p>;
  }

  return (
    <div>
      <h1>{t('builder.title')}</h1>
      <p className="muted">{t('builder.lead', { name: bank.name })}</p>
      <h3>{t('builder.topics')}</h3>
      <div className="row" style={{ marginBottom: 12 }}>
        {topics.map((t) => (
          <button key={t.id} type="button" className={`chip ${topicIds.includes(t.id) ? 'on' : ''}`} onClick={() => toggle(topicIds, setTopicIds, t.id)}>
            {t.name} ({t.count})
          </button>
        ))}
        {!topics.length && <span className="muted">{t('builder.noTags')}</span>}
      </div>
      <h3>{t('builder.skill')}</h3>
      <div className="row" style={{ marginBottom: 16 }}>
        {skills.map((t) => (
          <button key={t.id} type="button" className={`chip ${skillIds.includes(t.id) ? 'on' : ''}`} onClick={() => toggle(skillIds, setSkillIds, t.id)}>
            {t.name} ({t.count})
          </button>
        ))}
      </div>
      <div className="grid-3">
        <label className="field"><span>{t('builder.count')}</span><input type="number" min={1} max={80} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} /></label>
        <label className="field">
          <span>{t('builder.mode')}</span>
          <select value={questionMode} onChange={(e) => setQuestionMode(e.target.value)}>
            <option value="all">{t('builder.all')}</option>
            <option value="unsolved">{t('builder.unsolved')}</option>
            <option value="incorrect">{t('builder.incorrect')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('builder.format')}</span>
          <select value={examMode ? 'exam' : 'practice'} onChange={(e) => setExamMode(e.target.value === 'exam')}>
            <option value="practice">{t('builder.practice')}</option>
            <option value="exam">{t('builder.exam')}</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span><input type="checkbox" checked={randomizeAnswers} onChange={(e) => setRandomizeAnswers(e.target.checked)} /> {t('builder.shuffle')}</span>
      </label>
      {error && <p className="err">{error}</p>}
      <button className="btn lg" type="button" onClick={start}>{t('builder.start')}</button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';

export default function Tests() {
  const { t } = useLang();
  const [data, setData] = useState({ main: [], state_lang: [], subject: [], mainExam: null });
  const [cat, setCat] = useState('all');
  const [error, setError] = useState('');
  const { setBank } = useBank();
  const navigate = useNavigate();

  const cats = [
    { id: 'all', title: t('tests.all') },
    { id: 'main', title: t('tests.main') },
    { id: 'state_lang', title: t('tests.ky') },
    { id: 'subject', title: t('tests.subject') },
  ];

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
  const exam = data.mainExam;
  const showExam = cat === 'all' || cat === 'main';

  function open(subject, test) {
    setBank({
      subjectId: subject.id,
      testId: test?.id || null,
      name: subject.name,
      testName: test?.name,
      trackGroup: subject.trackGroup,
    });
    navigate(test ? `/app/create?bank=${test.id}` : '/app/create');
  }

  function openSimulation() {
    navigate('/app/exam');
  }

  return (
    <div>
      <h1>{t('tests.title')}</h1>
      <p className="muted">{t('tests.lead')}</p>
      <div className="tabs">
        {cats.map((c) => (
          <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.title}</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      {showExam && exam && (
        <div className="card ort-exam-card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="badge brand">{t('sim.badge')}</span>
              <h2 style={{ margin: '8px 0 6px' }}>{t('sim.title')}</h2>
              <p className="muted" style={{ margin: 0 }}>{t('sim.cardLead')}</p>
            </div>
            <button className="btn" type="button" disabled={!exam.ready} onClick={openSimulation}>
              {t('sim.open')}
            </button>
          </div>
          <div className="ort-exam-parts">
            {(exam.parts || []).map((part) => (
              <div key={part.key} className="ort-exam-part">
                <b>{part.title}</b>
                <span className="muted">
                  {t('tests.mainExamParts', { have: part.picked ?? part.have, need: part.needed })}
                  {part.officialMinutes ? ` · ${t('sim.minutes', { n: part.officialMinutes })}` : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {t('tests.mainExamShort', { n: exam.questionCount || 0 })}
            {' · '}
            {t('sim.minutes', { n: exam.officialMinutes || 215 })}
            {' · '}
            {t('results.max', { n: exam.maxScore || 245 })}
          </p>
        </div>
      )}
      <div className="cards">
        {list.map((subject) => {
          const tests = subject.Tests || subject.tests || [];
          return (
            <div key={subject.id} className="card">
              <h3>{subject.name}</h3>
              <p className="muted">{subject.description}</p>
              <p className="muted">{tests.length ? t('tests.ready') : t('tests.emptyBank')}</p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {tests.map((test) => (
                  <button key={test.id} className="btn" type="button" onClick={() => open(subject, test)}>
                    {test.name || t('tests.start')}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && <div className="empty">{t('tests.none')}</div>}
    </div>
  );
}

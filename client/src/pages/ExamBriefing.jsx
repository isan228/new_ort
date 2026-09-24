import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';

export default function ExamBriefing() {
  const { t } = useLang();
  const { setBank } = useBank();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    ortApi.mainExamPreview()
      .then(setExam)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
  }, [navigate]);

  async function start() {
    if (!accepted || starting) return;
    setError('');
    setStarting(true);
    try {
      const session = await ortApi.mainExam();
      setBank({
        name: t('tests.mainExam'),
        testName: t('sim.title'),
        testId: session.test?.id || null,
        trackGroup: 'main',
      });
      sessionStorage.removeItem('ortSimState');
      sessionStorage.setItem('ortSession', JSON.stringify({
        ...session,
        examType: 'main',
        simulation: true,
        examMode: true,
        instantFeedbackMode: false,
        startedAt: Date.now(),
        questionMode: 'main_exam',
        minutes: session.minutes || 215,
      }));
      navigate('/app/test');
    } catch (err) {
      if (isOrtGate(err)) navigate('/app/premium');
      else setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="exam-brief">
      <Link className="muted" to="/app/tests">← {t('tests.title')}</Link>
      <span className="badge brand" style={{ marginTop: 12 }}>{t('sim.badge')}</span>
      <h1>{t('sim.title')}</h1>
      <p className="muted">{t('sim.lead')}</p>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table exam-time-table">
          <thead>
            <tr>
              <th>{t('sim.colSection')}</th>
              <th>{t('sim.colQuestions')}</th>
              <th>{t('sim.colTime')}</th>
            </tr>
          </thead>
          <tbody>
            {(exam?.parts || []).map((part) => (
              <tr key={part.key}>
                <td>{part.title}</td>
                <td>{part.needed}</td>
                <td>{t('sim.minutes', { n: part.officialMinutes || part.minutes })}</td>
              </tr>
            ))}
            <tr>
              <td><b>{t('sim.total')}</b></td>
              <td><b>150</b></td>
              <td><b>{t('sim.minutes', { n: 215 })}</b></td>
            </tr>
          </tbody>
        </table>
        {exam && exam.questionCount < 150 && (
          <p className="muted" style={{ margin: '10px 0 0' }}>
            {t('tests.mainExamShort', { n: exam.questionCount || 0 })}
          </p>
        )}
      </div>

      <div className="grid-2 exam-rules-grid">
        <div className="card">
          <h3>{t('sim.needTitle')}</h3>
          <ul className="exam-rules">
            <li>{t('sim.need1')}</li>
            <li>{t('sim.need2')}</li>
            <li>{t('sim.need3')}</li>
            <li>{t('sim.need4')}</li>
            <li>{t('sim.need5')}</li>
            <li>{t('sim.need6')}</li>
          </ul>
        </div>
        <div className="card">
          <h3>{t('sim.notTitle')}</h3>
          <ul className="exam-rules">
            <li>{t('sim.not1')}</li>
            <li>{t('sim.not2')}</li>
            <li>{t('sim.not3')}</li>
            <li>{t('sim.not4')}</li>
            <li>{t('sim.not5')}</li>
            <li>{t('sim.not6')}</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h3>{t('sim.howTitle')}</h3>
        <ul className="exam-rules">
          <li>{t('sim.how1')}</li>
          <li>{t('sim.how2')}</li>
          <li>{t('sim.how3')}</li>
          <li>{t('sim.how4')}</li>
        </ul>
      </div>

      {error && <p className="err">{error}</p>}
      <label className="exam-accept">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>{t('sim.accept')}</span>
      </label>
      <div className="row">
        <button className="btn" type="button" disabled={!accepted || !exam?.ready || starting} onClick={start}>
          {starting ? t('common.loading') : t('sim.start')}
        </button>
        <Link className="btn ghost" to="/app/tests">{t('common.cancel')}</Link>
      </div>
    </div>
  );
}

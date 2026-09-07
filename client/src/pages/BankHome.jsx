import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';

export default function BankHome() {
  const { bank } = useBank();
  const [stats, setStats] = useState(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const testId = Number(params.get('bank') || bank?.testId);

  useEffect(() => {
    if (!testId) return;
    ortApi.welcomeStats(testId)
      .then(setStats)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/subscriptions');
      });
  }, [testId, navigate]);

  if (!bank && !testId) {
    return <p>Сначала выберите банк на <Link to="/ort">главной</Link>.</p>;
  }

  return (
    <div>
      <p className="muted"><Link to="/ort">Все банки</Link></p>
      <h1 className="serif">{bank?.name || 'Банк'}</h1>
      <p className="muted">{bank?.testName}</p>
      {stats && (
        <div className="stats">
          <div className="stat"><b>{stats.totalQuestions}</b><span className="muted">вопросов</span></div>
          <div className="stat"><b>{stats.touched}</b><span className="muted">уже решали</span></div>
          <div className="stat"><b>{stats.unsolved}</b><span className="muted">не трогали</span></div>
          <div className="stat"><b>{stats.lastAccuracy ?? '—'}%</b><span className="muted">последняя точность</span></div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn" to="/ort-create">Собрать тест</Link>
        <Link className="btn ghost" to="/ort-history">История</Link>
        <Link className="btn ghost" to="/ort-flashcards">Карточки</Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';

export default function History() {
  const { bank } = useBank();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!bank?.testId) return;
    ortApi.history(bank.testId)
      .then((d) => setRows(d.history || []))
      .catch((err) => { if (isOrtGate(err)) navigate('/app/premium'); });
  }, [bank, navigate]);

  return (
    <div>
      <h1>История</h1>
      {!bank?.testId && <p className="muted">Выбери банк в <Link to="/app/tests">тестах</Link>.</p>}
      <table className="table">
        <thead><tr><th>Дата</th><th>Балл</th><th>Точность</th><th>Режим</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleString('ru-KG')}</td>
              <td>{r.score}/{r.total}</td>
              <td>{r.accuracy}%</td>
              <td>{r.questionMode}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty">Попыток ещё нет.</div>}
    </div>
  );
}

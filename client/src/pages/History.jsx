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
      .catch((err) => {
        if (isOrtGate(err)) navigate('/subscriptions');
      });
  }, [bank, navigate]);

  if (!bank?.testId) return <p>Выберите банк на <Link to="/ort">главной</Link>.</p>;

  return (
    <div>
      <h1 className="serif">История · {bank.name}</h1>
      {!rows.length && <p className="muted">Попыток ещё нет.</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Балл</th>
            <th>Точность</th>
            <th>Режим</th>
            <th>Время</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleString('ru-KG')}</td>
              <td>{r.score}/{r.total}</td>
              <td>{r.accuracy}%</td>
              <td>{r.questionMode || 'all'}</td>
              <td>{r.durationSec ? `${Math.round(r.durationSec / 60)} мин` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

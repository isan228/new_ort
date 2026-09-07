import { useState } from 'react';
import { RANKING } from '../lib/progress';
import { useAuth } from '../context/AuthContext';

export default function Ranking() {
  const { user } = useAuth();
  const [tab, setTab] = useState('week');
  const me = user?.name || 'Ты';

  return (
    <div>
      <h1>Рейтинг ORT.KG</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <b>Ты — #127</b>
        <p className="muted">214 баллов · продолжай серию, чтобы подняться</p>
      </div>
      <div className="tabs">
        {[['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <table className="table">
        <thead><tr><th>#</th><th>Ученик</th><th>Баллы</th><th>Прогресс</th><th>Streak</th></tr></thead>
        <tbody>
          {RANKING.map((row) => (
            <tr key={row.place} className={row.name === me ? 'you' : ''}>
              <td>{row.place <= 3 ? ['🥇', '🥈', '🥉'][row.place - 1] : row.place}</td>
              <td className="row"><span className="avatar">{row.name[0]}</span> {row.name}</td>
              <td>{row.score}</td>
              <td><div className="progress"><i style={{ width: `${row.progress}%` }} /></div></td>
              <td>{row.streak} дн.</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

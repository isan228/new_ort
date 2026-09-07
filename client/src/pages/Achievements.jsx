import { ACHIEVEMENTS } from '../lib/progress';

export default function Achievements() {
  return (
    <div>
      <h1>Достижения</h1>
      <p className="muted">Не игра, а метки системной работы. Открывай их каждый день.</p>
      <div className="cards">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`card ${a.unlocked ? '' : 'locked'}`}>
            <div style={{ fontSize: 28 }}>{a.icon}</div>
            <h3>{a.title}</h3>
            <p className="muted">{a.text}</p>
            <span className={`badge ${a.unlocked ? 'ok' : ''}`}>{a.unlocked ? 'Открыто' : 'Ещё нет'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

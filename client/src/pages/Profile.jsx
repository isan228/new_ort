import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ACHIEVEMENTS, loadProgress } from '../lib/progress';

export default function Profile() {
  const { user } = useAuth();
  const p = loadProgress();
  const initial = (user?.name || 'У')[0];

  return (
    <div>
      <div className="card row" style={{ gap: 16 }}>
        <span className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{initial}</span>
        <div>
          <h1>{user?.name}</h1>
          <p className="muted">ORT Explorer — Level 12</p>
          <span className="badge brand">#{127} в рейтинге</span>
        </div>
      </div>
      <div className="grid-4" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{p.goalScore}+</b><span className="muted">цель</span></div>
        <div className="card stat"><b>1284</b><span className="muted">вопросов</span></div>
        <div className="card stat"><b>{p.streak}</b><span className="muted">streak</span></div>
        <div className="card stat"><b>{ACHIEVEMENTS.filter((a) => a.unlocked).length}</b><span className="muted">достижений</span></div>
      </div>
      <div style={{ marginTop: 16 }}><Link className="btn" to="/app/settings">Настройки</Link></div>
    </div>
  );
}

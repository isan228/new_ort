import { loadProgress } from '../lib/progress';
import { Link } from 'react-router-dom';

export default function Favorites() {
  const p = loadProgress();
  return (
    <div>
      <h1>Избранное</h1>
      <p className="muted">Вопросы, которые ты отметил во время теста.</p>
      {!p.favorites?.length && (
        <div className="empty">
          Пока пусто. На экране теста нажми «В избранное».
          <div style={{ marginTop: 12 }}><Link className="btn" to="/app/tests">Начать тест</Link></div>
        </div>
      )}
      <ul>
        {(p.favorites || []).map((id) => <li key={id}>Вопрос #{id}</li>)}
      </ul>
    </div>
  );
}

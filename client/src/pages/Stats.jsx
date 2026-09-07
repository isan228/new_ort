import { Link } from 'react-router-dom';
import { activityDays, loadProgress } from '../lib/progress';

export default function Stats() {
  const p = loadProgress();
  const days = activityDays();
  const line = [188, 192, 190, 198, 201, 206, 204, 210, 208, 214];

  return (
    <div>
      <h1>Статистика</h1>
      <div className="grid-4">
        <div className="card stat"><b>206</b><span className="muted">средний балл</span></div>
        <div className="card stat"><b>218</b><span className="muted">лучший</span></div>
        <div className="card stat"><b>14</b><span className="muted">тестов</span></div>
        <div className="card stat"><b>1 284</b><span className="muted">вопросов</span></div>
      </div>
      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card stat"><b>81%</b><span className="muted">точность</span></div>
        <div className="card stat"><b>37 ч</b><span className="muted">время обучения</span></div>
        <div className="card stat"><b>{p.streak}</b><span className="muted">streak</span></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Результат по дням</h3>
        <svg viewBox="0 0 320 120" width="100%" height="120">
          <polyline fill="none" stroke="var(--brand)" strokeWidth="3" points={line.map((v, i) => `${i * 35},${110 - (v - 180) * 2}`).join(' ')} />
        </svg>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Точность по темам</h3>
          <div className="bar-row"><span>Грамматика</span><div className="progress"><i style={{ width: '91%' }} /></div><b>91%</b></div>
          <div className="bar-row"><span>Математика</span><div className="progress"><i style={{ width: '68%' }} /></div><b>68%</b></div>
          <div className="bar-row"><span>Чтение</span><div className="progress"><i style={{ width: '74%' }} /></div><b>74%</b></div>
          <div className="bar-row"><span>Аналогии</span><div className="progress"><i style={{ width: '61%' }} /></div><b>61%</b></div>
        </div>
        <div className="card">
          <h3>Активность</h3>
          <div className="heat">{days.map((d) => <i key={d.key} className={d.level ? `l${d.level}` : ''} />)}</div>
          <h3 style={{ marginTop: 16 }}>Слабые темы</h3>
          <ol>
            <li>Аналогии — 61%</li>
            <li>Математика — 68%</li>
            <li>Чтение — 74%</li>
          </ol>
          <Link className="btn" to="/app/errors">Начать улучшение</Link>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { activityDays, loadProgress } from '../lib/progress';

export default function Home() {
  const { user } = useAuth();
  const p = loadProgress();
  const left = Math.max(0, p.dailyGoal - p.todayQuestions);
  const pct = Math.round((p.todayQuestions / p.dailyGoal) * 100);
  const days = activityDays();
  const first = (user?.name || 'друг').split(' ')[0];

  return (
    <div>
      <h1>Привет, {first}!</h1>
      <p className="muted">Твоя цель — {p.goalScore}+ баллов</p>

      <div className="grid-2">
        <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="circle" style={{ '--p': 78 }}><span>78%</span></div>
            <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>Прогресс подготовки</p>
          </div>
          <div style={{ flex: 1 }}>
            <h2>Твой прогресс</h2>
            <p className="muted">Системно закрываешь темы основного теста. Дальше — аналогии и чтение.</p>
            <Link className="btn" to="/app/tests">Продолжить подготовку</Link>
          </div>
        </div>
        <div className="card">
          <div className="muted">Следующая тема</div>
          <h2 style={{ fontSize: 32 }}>Аналогии</h2>
          <span className="badge">точность 61%</span>
          <p className="muted" style={{ marginTop: 12 }}>Здесь чаще всего теряются баллы. 10 вопросов сегодня закроют слот дневной цели.</p>
          <Link className="btn" to="/app/tests">Тренировать аналогии</Link>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Цель на сегодня</h3>
          <b style={{ fontSize: 28 }}>{p.todayQuestions} / {p.dailyGoal} вопросов</b>
          <div className="progress" style={{ margin: '12px 0' }}><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
          <p className="muted">20 вопросов — Математика</p>
          <p className="muted">10 вопросов — Аналогии</p>
          <p className="muted">10 вопросов — Чтение</p>
          <Link className="btn" to="/app/tests">Продолжить подготовку</Link>
        </div>
        <div className="card">
          <h3>Серия</h3>
          <b style={{ fontSize: 28 }}>{p.streak} дней подряд</b>
          <p className="muted">Не прерывай серию. Сегодня осталось решить {left} вопросов.</p>
          <div className="heat" style={{ marginTop: 12 }}>
            {days.map((d) => <i key={d.key} className={d.level ? `l${d.level}` : ''} title={d.label} />)}
          </div>
        </div>
        <div className="card">
          <h3>Слабые темы</h3>
          <div className="bar-row"><span>Аналогии</span><div className="progress"><i style={{ width: '61%' }} /></div><b>61%</b></div>
          <div className="bar-row"><span>Математика</span><div className="progress"><i style={{ width: '68%' }} /></div><b>68%</b></div>
          <div className="bar-row"><span>Чтение</span><div className="progress"><i style={{ width: '74%' }} /></div><b>74%</b></div>
          <Link className="btn ghost" to="/app/errors">Повторить ошибки</Link>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { PublicShell } from '../components/Shells';

const FEATURES = [
  { title: 'Тесты', text: 'Тысячи вопросов для подготовки: основной тест, госязык и предметные.' },
  { title: 'Флеш-карты', text: 'Запоминай сложные темы быстрее — с интервальным повторением.' },
  { title: 'Аналитика', text: 'Понимай сильные и слабые стороны по темам и типам заданий.' },
  { title: 'Рейтинг', text: 'Сравнивай свой результат с другими учениками ORT.KG.' },
  { title: 'Персональный прогресс', text: 'Система показывает, что изучать дальше и где ты теряешь баллы.' },
  { title: 'Разбор ошибок', text: 'Возвращайся к вопросам, которые решил неправильно, пока не закроешь тему.' },
];

export default function Landing() {
  return (
    <PublicShell>
      <div className="page page-wide">
        <section className="hero">
          <div>
            <p className="badge brand">Платформа подготовки к ОРТ</p>
            <h1 style={{ fontSize: 44, marginTop: 14 }}>Готовься к ОРТ системно. Повышай свой результат каждый день.</h1>
            <p className="muted" style={{ fontSize: 18, maxWidth: 520 }}>
              Тесты, флеш-карты, статистика и персональный план подготовки — всё в одном месте.
            </p>
            <div className="row" style={{ marginTop: 20 }}>
              <Link className="btn lg" to="/register">Начать подготовку</Link>
              <Link className="btn ghost lg" to="/register">Попробовать бесплатно</Link>
            </div>
          </div>
          <div className="mock">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="muted">Прогноз ОРТ</div>
                <b style={{ fontSize: 32 }}>214 / 250</b>
              </div>
              <span className="badge ok">+12 за 14 дней</span>
            </div>
            <div className="progress" style={{ margin: '14px 0' }}><i style={{ width: '78%' }} /></div>
            <div className="grid-3">
              <div className="card stat" style={{ boxShadow: 'none' }}><b>12</b><span className="muted">дней streak</span></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><b>1 284</b><span className="muted">вопросов</span></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><b>81%</b><span className="muted">точность</span></div>
            </div>
            <div style={{ height: 88, marginTop: 16, borderRadius: 12, background: 'linear-gradient(180deg, var(--brand-soft), transparent)', position: 'relative', overflow: 'hidden' }}>
              <svg viewBox="0 0 320 88" width="100%" height="88" preserveAspectRatio="none">
                <polyline fill="none" stroke="var(--brand)" strokeWidth="3" points="0,70 40,62 80,58 120,40 160,48 200,28 240,32 280,18 320,22" />
              </svg>
            </div>
          </div>
        </section>

        <h2 style={{ marginTop: 48 }}>Почему ORT.KG</h2>
        <div className="cards">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}

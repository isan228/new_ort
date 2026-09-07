import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const SIDE = [
  ['/app', 'Dashboard'],
  ['/app/tests', 'Тесты'],
  ['/app/flashcards', 'Флеш-карты'],
  ['/app/errors', 'Мои ошибки'],
  ['/app/favorites', 'Избранное'],
  ['/app/stats', 'Статистика'],
  ['/app/ranking', 'Рейтинг'],
  ['/app/achievements', 'Достижения'],
  ['/app/referral', 'Реферальная программа'],
  ['/app/premium', 'Подписка'],
  ['/app/settings', 'Настройки'],
];

const BOTTOM = [
  ['/app', 'Главная'],
  ['/app/tests', 'Тесты'],
  ['/app/flashcards', 'Карты'],
  ['/app/ranking', 'Рейтинг'],
  ['/app/profile', 'Профиль'],
];

export function BrandLogo({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`logo ${className}`.trim()}>
      <img src="/logo.png" alt="ORT.KG" className="logo-img" />
    </Link>
  );
}

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { toggle, theme } = useTheme();
  const navigate = useNavigate();
  const initial = (user?.name || 'У')[0].toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo to="/app" />
        {SIDE.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {label}
          </NavLink>
        ))}
      </aside>
      <div className="app-main">
        <div className="app-top">
          <div className="muted">Системная подготовка к ОРТ</div>
          <div className="row">
            <button type="button" className="btn ghost sm" onClick={toggle}>{theme === 'dark' ? 'Светлая' : 'Тёмная'}</button>
            <Link to="/app/profile" className="avatar">{initial}</Link>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => { logout(); navigate('/'); }}
            >
              Выйти
            </button>
          </div>
        </div>
        <div className="app-body">{children}</div>
      </div>
      <nav className="bottom-nav">
        {BOTTOM.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => isActive ? 'active' : ''}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PublicShell({ children }) {
  const { user } = useAuth();
  return (
    <>
      <header className="public-header">
        <BrandLogo to="/" />
        <nav className="nav-links">
          <NavLink to="/">Главная</NavLink>
          <a href="/#programma">Программа</a>
          <a href="/#kak">Как это работает</a>
          <NavLink to="/pricing">Тарифы</NavLink>
        </nav>
        <div className="row">
          {user ? (
            <Link className="btn" to="/app">Кабинет</Link>
          ) : (
            <>
              <Link className="btn ghost" to="/login">Войти</Link>
              <Link className="btn" to="/register">Начать подготовку</Link>
            </>
          )}
        </div>
      </header>
      {children}
    </>
  );
}

export function AdminShell({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const root = '/админ';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo to={root} />
        <NavLink to={root} end className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to={`${root}/users`} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Пользователи</NavLink>
        <NavLink to={`${root}/content`} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Тесты и вопросы</NavLink>
        <NavLink to={`${root}/flashcards`} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Флеш-карты</NavLink>
        <NavLink to={`${root}/plans`} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Подписки</NavLink>
        <button type="button" className="side-link" style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => { logout(); navigate(root); }}>Выйти</button>
      </aside>
      <div className="app-main">
        <div className="admin-top"><b>ORT.KG · управление</b></div>
        <div className="app-body">{children}</div>
      </div>
    </div>
  );
}

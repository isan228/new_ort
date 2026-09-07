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

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { toggle, theme } = useTheme();
  const navigate = useNavigate();
  const initial = (user?.name || 'У')[0].toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/app" className="logo" style={{ margin: '4px 10px 18px' }}>
          <span className="logo-mark">ORT</span> ORT.KG
        </Link>
        {SIDE.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {label}
          </NavLink>
        ))}
        {user?.role === 'admin' && <NavLink to="/admin" className="side-link">Админка</NavLink>}
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
        <Link to="/" className="logo"><span className="logo-mark">ORT</span> ORT.KG</Link>
        <nav className="nav-links">
          <NavLink to="/">Главная</NavLink>
          <NavLink to="/app/tests">Тесты</NavLink>
          <NavLink to="/app/flashcards">Флеш-карты</NavLink>
          <NavLink to="/app/ranking">Рейтинг</NavLink>
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/admin" className="logo" style={{ margin: '4px 10px 18px' }}>
          <span className="logo-mark">A</span> Админ
        </Link>
        <NavLink to="/admin" end className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Пользователи</NavLink>
        <NavLink to="/admin/content" className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Тесты и вопросы</NavLink>
        <NavLink to="/admin/flashcards" className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Флеш-карты</NavLink>
        <NavLink to="/admin/plans" className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>Подписки</NavLink>
        <NavLink to="/app" className="side-link">К кабинету</NavLink>
        <button type="button" className="side-link" style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => { logout(); navigate('/'); }}>Выйти</button>
      </aside>
      <div className="app-main">
        <div className="admin-top"><b>ORT.KG · управление</b></div>
        <div className="app-body">{children}</div>
      </div>
    </div>
  );
}

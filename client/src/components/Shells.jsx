import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
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

const ADMIN_ROOT = '/админ';
const ADMIN_SIDE = [
  [ADMIN_ROOT, 'Dashboard'],
  [`${ADMIN_ROOT}/users`, 'Пользователи'],
  [`${ADMIN_ROOT}/content`, 'Тесты и вопросы'],
  [`${ADMIN_ROOT}/flashcards`, 'Флеш-карты'],
  [`${ADMIN_ROOT}/plans`, 'Подписки'],
];

function useMenu() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    return () => document.body.classList.remove('menu-open');
  }, [open]);

  return [open, setOpen];
}

function MenuBtn({ open, onClick }) {
  return (
    <button type="button" className={`menu-btn ${open ? 'open' : ''}`} aria-label={open ? 'Закрыть меню' : 'Открыть меню'} onClick={onClick}>
      <span />
      <span />
      <span />
    </button>
  );
}

function Drawer({ open, onClose, children }) {
  return (
    <div className={`drawer ${open ? 'open' : ''}`}>
      <button type="button" className="drawer-back" aria-label="Закрыть" onClick={onClose} />
      <aside className="drawer-panel">{children}</aside>
    </div>
  );
}

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
  const [open, setOpen] = useMenu();
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
          <div className="top-left">
            <MenuBtn open={open} onClick={() => setOpen((v) => !v)} />
            <BrandLogo to="/app" className="logo-mobile" />
            <div className="muted top-title">Системная подготовка к ОРТ</div>
          </div>
          <div className="row top-actions">
            <button type="button" className="btn ghost sm" onClick={toggle}>{theme === 'dark' ? 'Светлая' : 'Тёмная'}</button>
            <Link to="/app/profile" className="avatar">{initial}</Link>
            <button
              type="button"
              className="btn ghost sm hide-sm"
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
      <Drawer open={open} onClose={() => setOpen(false)}>
        <BrandLogo to="/app" />
        {SIDE.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {label}
          </NavLink>
        ))}
        <button type="button" className="side-link" onClick={() => { logout(); navigate('/'); }}>Выйти</button>
      </Drawer>
    </div>
  );
}

export function PublicShell({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useMenu();

  return (
    <>
      <header className="public-header">
        <div className="top-left">
          <MenuBtn open={open} onClick={() => setOpen((v) => !v)} />
          <BrandLogo to="/" />
        </div>
        <nav className="nav-links">
          <NavLink to="/">Главная</NavLink>
          <a href="/#programma">Программа</a>
          <a href="/#kak">Как это работает</a>
          <NavLink to="/pricing">Тарифы</NavLink>
        </nav>
        <div className="row header-actions">
          {user ? (
            <Link className="btn" to="/app">Кабинет</Link>
          ) : (
            <>
              <Link className="btn ghost" to="/login">Войти</Link>
              <Link className="btn hide-sm" to="/register">Начать подготовку</Link>
            </>
          )}
        </div>
      </header>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <BrandLogo to="/" />
        <NavLink to="/" className="side-link">Главная</NavLink>
        <a href="/#programma" className="side-link" onClick={() => setOpen(false)}>Программа</a>
        <a href="/#kak" className="side-link" onClick={() => setOpen(false)}>Как это работает</a>
        <NavLink to="/pricing" className="side-link">Тарифы</NavLink>
        {user ? (
          <NavLink to="/app" className="side-link">Кабинет</NavLink>
        ) : (
          <>
            <NavLink to="/login" className="side-link">Войти</NavLink>
            <NavLink to="/register" className="side-link">Начать подготовку</NavLink>
          </>
        )}
      </Drawer>
      {children}
    </>
  );
}

export function AdminShell({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useMenu();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo to={ADMIN_ROOT} />
        {ADMIN_SIDE.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === ADMIN_ROOT} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {label}
          </NavLink>
        ))}
        <button type="button" className="side-link drawer-exit" onClick={() => { logout(); navigate(ADMIN_ROOT); }}>Выйти</button>
      </aside>
      <div className="app-main">
        <div className="admin-top">
          <div className="top-left">
            <MenuBtn open={open} onClick={() => setOpen((v) => !v)} />
            <BrandLogo to={ADMIN_ROOT} className="logo-mobile" />
            <b className="top-title">ORT.KG · управление</b>
          </div>
        </div>
        <div className="app-body">{children}</div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <BrandLogo to={ADMIN_ROOT} />
        {ADMIN_SIDE.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === ADMIN_ROOT} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {label}
          </NavLink>
        ))}
        <button type="button" className="side-link drawer-exit" onClick={() => { logout(); navigate(ADMIN_ROOT); }}>Выйти</button>
      </Drawer>
    </div>
  );
}

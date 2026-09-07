import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { LangSwitch } from './LangSwitch';

const SIDE = [
  ['/app', 'nav.dashboard'],
  ['/app/tests', 'nav.tests'],
  ['/app/flashcards', 'nav.flashcards'],
  ['/app/errors', 'nav.errors'],
  ['/app/favorites', 'nav.favorites'],
  ['/app/stats', 'nav.stats'],
  ['/app/ranking', 'nav.ranking'],
  ['/app/achievements', 'nav.achievements'],
  ['/app/referral', 'nav.referral'],
  ['/app/premium', 'nav.premium'],
  ['/app/settings', 'nav.settings'],
];

const BOTTOM = [
  ['/app', 'nav.dashboard'],
  ['/app/tests', 'nav.tests'],
  ['/app/flashcards', 'nav.cardsShort'],
  ['/app/ranking', 'nav.ranking'],
  ['/app/profile', 'nav.profile'],
];

const ADMIN_ROOT = '/админ';
const ADMIN_SIDE = [
  [ADMIN_ROOT, 'admin.dashboard'],
  [`${ADMIN_ROOT}/users`, 'admin.users'],
  [`${ADMIN_ROOT}/content`, 'admin.program'],
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
  const { t } = useLang();
  return (
    <button type="button" className={`menu-btn ${open ? 'open' : ''}`} aria-label={open ? t('common.closeMenu') : t('common.openMenu')} onClick={onClick}>
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
  const { t } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useMenu();
  const initial = (user?.name || 'У')[0].toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo to="/app" />
        {SIDE.map(([to, key]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {t(key)}
          </NavLink>
        ))}
      </aside>
      <div className="app-main">
        <div className="app-top">
          <div className="top-left">
            <MenuBtn open={open} onClick={() => setOpen((v) => !v)} />
            <BrandLogo to="/app" className="logo-mobile" />
            <div className="muted top-title">{t('public.prep')}</div>
          </div>
          <div className="row top-actions">
            <LangSwitch />
            <button type="button" className="btn ghost sm" onClick={toggle}>{theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}</button>
            <Link to="/app/profile" className="avatar">{initial}</Link>
            <button
              type="button"
              className="btn ghost sm hide-sm"
              onClick={() => { logout(); navigate('/'); }}
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
        <div className="app-body">{children}</div>
      </div>
      <nav className="bottom-nav">
        {BOTTOM.map(([to, key]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => isActive ? 'active' : ''}>
            {t(key)}
          </NavLink>
        ))}
      </nav>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <BrandLogo to="/app" />
        <LangSwitch />
        {SIDE.map(([to, key]) => (
          <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {t(key)}
          </NavLink>
        ))}
        <button type="button" className="side-link" onClick={() => { logout(); navigate('/'); }}>{t('common.logout')}</button>
      </Drawer>
    </div>
  );
}

export function PublicShell({ children }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [open, setOpen] = useMenu();

  return (
    <>
      <header className="public-header">
        <div className="top-left">
          <MenuBtn open={open} onClick={() => setOpen((v) => !v)} />
          <BrandLogo to="/" />
        </div>
        <nav className="nav-links">
          <NavLink to="/">{t('nav.home')}</NavLink>
          <a href="/#programma">{t('nav.program')}</a>
          <a href="/#kak">{t('nav.how')}</a>
          <NavLink to="/pricing">{t('nav.pricing')}</NavLink>
        </nav>
        <div className="row header-actions">
          <LangSwitch />
          {user ? (
            <Link className="btn" to="/app">{t('nav.cabinet')}</Link>
          ) : (
            <>
              <Link className="btn ghost" to="/login">{t('common.enter')}</Link>
              <Link className="btn hide-sm" to="/register">{t('nav.start')}</Link>
            </>
          )}
        </div>
      </header>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <BrandLogo to="/" />
        <LangSwitch />
        <NavLink to="/" className="side-link">{t('nav.home')}</NavLink>
        <a href="/#programma" className="side-link" onClick={() => setOpen(false)}>{t('nav.program')}</a>
        <a href="/#kak" className="side-link" onClick={() => setOpen(false)}>{t('nav.how')}</a>
        <NavLink to="/pricing" className="side-link">{t('nav.pricing')}</NavLink>
        {user ? (
          <NavLink to="/app" className="side-link">{t('nav.cabinet')}</NavLink>
        ) : (
          <>
            <NavLink to="/login" className="side-link">{t('common.enter')}</NavLink>
            <NavLink to="/register" className="side-link">{t('nav.start')}</NavLink>
          </>
        )}
      </Drawer>
      {children}
    </>
  );
}

export function AdminShell({ children }) {
  const { logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useMenu();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo to={ADMIN_ROOT} />
        {ADMIN_SIDE.map(([to, key]) => (
          <NavLink key={to} to={to} end={to === ADMIN_ROOT} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {t(key)}
          </NavLink>
        ))}
        <button type="button" className="side-link drawer-exit" onClick={() => { logout(); navigate(ADMIN_ROOT); }}>{t('common.logout')}</button>
      </aside>
      <div className="app-main">
        <div className="admin-top">
          <div className="top-left">
            <MenuBtn open={open} onClick={() => setOpen((v) => !v)} />
            <BrandLogo to={ADMIN_ROOT} className="logo-mobile" />
            <b className="top-title">{t('admin.manage')}</b>
          </div>
          <LangSwitch />
        </div>
        <div className="app-body">{children}</div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <BrandLogo to={ADMIN_ROOT} />
        <LangSwitch />
        {ADMIN_SIDE.map(([to, key]) => (
          <NavLink key={to} to={to} end={to === ADMIN_ROOT} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            {t(key)}
          </NavLink>
        ))}
        <button type="button" className="side-link drawer-exit" onClick={() => { logout(); navigate(ADMIN_ROOT); }}>{t('common.logout')}</button>
      </Drawer>
    </div>
  );
}

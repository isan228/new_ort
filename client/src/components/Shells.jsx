import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { chatApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { LangSwitch } from './LangSwitch';
import { CabinetDock } from './CabinetDock';
import '../styles/coursology.css';

const SIDE = [
  ['/app', 'nav.dashboard'],
  ['/app/tests', 'nav.tests'],
  ['/app/create', 'nav.create'],
  ['/app/flashcards', 'nav.flashcards'],
  ['/app/errors', 'nav.errors'],
  ['/app/favorites', 'nav.favorites'],
  ['/app/stats', 'nav.stats'],
  ['/app/history', 'nav.history'],
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
  [`${ADMIN_ROOT}/plans`, 'admin.plans'],
  [`${ADMIN_ROOT}/chat`, 'admin.chat'],
];

const ICON_PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  tests: 'M9 4h6M8 4H6a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2M9 11l2 2 4-4M9 17h6',
  create: 'M12 5v14M5 12h14',
  cards: 'M4 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM17 8l2.6.7a2 2 0 0 1 1.4 2.4l-2.3 8.7',
  errors: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  ranking: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7',
  crown: 'm2 18 2-11 5 5 3-7 3 7 5-5 2 11z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  users: 'M17 21a6 6 0 0 0-12 0M11 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21a5 5 0 0 0-4-4.9M16 5.1a4 4 0 0 1 0 7.8',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8M7.5 7.5h.01',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

const ROUTE_ICON = {
  '/app': 'home',
  '/app/tests': 'tests',
  '/app/create': 'create',
  '/app/flashcards': 'cards',
  '/app/errors': 'errors',
  '/app/favorites': 'star',
  '/app/stats': 'stats',
  '/app/history': 'history',
  '/app/ranking': 'ranking',
  '/app/achievements': 'award',
  '/app/referral': 'gift',
  '/app/premium': 'crown',
  '/app/settings': 'settings',
  '/app/profile': 'user',
  [ADMIN_ROOT]: 'home',
  [`${ADMIN_ROOT}/users`]: 'users',
  [`${ADMIN_ROOT}/content`]: 'book',
  [`${ADMIN_ROOT}/plans`]: 'tag',
  [`${ADMIN_ROOT}/chat`]: 'chat',
};

function Icon({ name, size = 20 }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function useUnreadChat() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const data = await chatApi.unread();
        if (!stop) setUnread(data.unread || 0);
      } catch {
        if (!stop) setUnread(0);
      }
    }
    tick();
    const id = setInterval(tick, 10000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  return unread;
}

function SideItem({ to, label, end, unread }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
      <Icon name={ROUTE_ICON[to]} />
      <span>{label}</span>
      {unread > 0 && <span className="nav-unread">{unread > 99 ? '99+' : unread}</span>}
    </NavLink>
  );
}

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
      <img src="/logo-icon.png" alt="" className="logo-img" />
      <span>ORT.KG</span>
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
          <SideItem key={to} to={to} end={to === '/app'} label={t(key)} />
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
            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label={theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
              title={theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
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
            <span className="bottom-nav-icon"><Icon name={ROUTE_ICON[to]} size={21} /></span>
            <span className="bottom-nav-label">{t(key)}</span>
          </NavLink>
        ))}
      </nav>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <BrandLogo to="/app" />
        <LangSwitch />
        {SIDE.map(([to, key]) => (
          <SideItem key={to} to={to} end={to === '/app'} label={t(key)} />
        ))}
        <button type="button" className="side-link drawer-exit" onClick={() => { logout(); navigate('/'); }}><Icon name="logout" /><span>{t('common.logout')}</span></button>
      </Drawer>
      <CabinetDock />
    </div>
  );
}

export function AuthLayout({ title, hint, wide = false, children }) {
  return (
    <section className="cl-auth">
      <div className={`cl-auth-inner ${wide ? 'wide' : ''}`}>
        <div className="cl-auth-head">
          <h1>{title}</h1>
          {hint && <p>{hint}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function PublicShell({ children }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [open, setOpen] = useMenu();

  useEffect(() => {
    document.body.classList.add('cl-body');
    return () => document.body.classList.remove('cl-body');
  }, []);

  return (
    <>
      <header className="cl-header">
        <div className="cl-container">
          <div className="cl-header-bar">
            <div className="cl-header-left">
              <MenuBtn open={open} onClick={() => setOpen((v) => !v)} />
              <BrandLogo to="/" />
            </div>
            <nav className="cl-header-nav">
              <a href="/#platforma">{t('land.kickerPlat')}</a>
              <a href="/#programma">{t('nav.program')}</a>
              <a href="/#kak">{t('nav.how')}</a>
              <NavLink to="/pricing">{t('nav.pricing')}</NavLink>
            </nav>
            <div className="cl-header-right">
              <LangSwitch />
              {user ? (
                <Link className="cl-pill" to="/app">{t('nav.cabinet')}</Link>
              ) : (
                <>
                  <Link className="cl-header-link hide-sm" to="/login">{t('common.enter')}</Link>
                  <Link className="cl-pill" to="/register">{t('land.cl.start')}</Link>
                </>
              )}
            </div>
          </div>
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
  const unread = useUnreadChat();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo to={ADMIN_ROOT} />
        {ADMIN_SIDE.map(([to, key]) => (
          <SideItem key={to} to={to} end={to === ADMIN_ROOT} label={t(key)} unread={to.endsWith('/chat') ? unread : 0} />
        ))}
        <button type="button" className="side-link drawer-exit" onClick={() => { logout(); navigate(ADMIN_ROOT); }}><Icon name="logout" /><span>{t('common.logout')}</span></button>
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
          <SideItem key={to} to={to} end={to === ADMIN_ROOT} label={t(key)} unread={to.endsWith('/chat') ? unread : 0} />
        ))}
        <button type="button" className="side-link drawer-exit" onClick={() => { logout(); navigate(ADMIN_ROOT); }}><Icon name="logout" /><span>{t('common.logout')}</span></button>
      </Drawer>
    </div>
  );
}

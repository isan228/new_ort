import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBank } from '../context/BankContext';

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const { bank } = useBank();
  const navigate = useNavigate();

  return (
    <>
      <header className="topbar">
        <NavLink to={user ? '/ort' : '/'} className="brand">
          <span className="brand-mark">ОРТ 2026</span>
          <span className="brand-sub">подготовка для школьников КР</span>
        </NavLink>
        {user && (
          <nav className="nav">
            <NavLink to="/ort">Банки</NavLink>
            {bank && <NavLink to="/ort-home">Банк</NavLink>}
            {bank && <NavLink to="/ort-create">Конструктор</NavLink>}
            {bank && <NavLink to="/ort-history">История</NavLink>}
            {bank && <NavLink to="/ort-flashcards">Карточки</NavLink>}
            <NavLink to="/subscriptions">Подписка</NavLink>
            {user.role === 'admin' && <NavLink to="/admin">Админка</NavLink>}
            <span className="muted">{user.name}</span>
            <button
              className="link"
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Выйти
            </button>
          </nav>
        )}
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export function Gate({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted">Загрузка…</p>;
  if (!user) return null;
  return children;
}

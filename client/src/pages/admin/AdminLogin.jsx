import { useState } from 'react';
import { BrandLogo } from '../../components/Shells';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await adminLogin({ login, password });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandLogo to="/" />
      </div>
      <div className="card">
        <h1>Админ</h1>
        <p className="muted">Служебный вход. Не для учеников.</p>
        <form onSubmit={onSubmit}>
          <label className="field"><span>Логин</span><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required /></label>
          <label className="field"><span>Пароль</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
          {error && <p className="err">{error}</p>}
          <button className="btn lg" type="submit" style={{ width: '100%' }}>Войти</button>
        </form>
      </div>
    </div>
  );
}

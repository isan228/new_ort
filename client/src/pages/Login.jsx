import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicShell } from '../components/Shells';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [ident, setIdent] = useState('demo');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login({ login: ident, password });
      navigate('/app');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PublicShell>
      <div className="page" style={{ maxWidth: 440 }}>
        <div className="card">
          <h1>Вход</h1>
          <p className="muted">Демо ученик: demo / demo123</p>
          <form onSubmit={onSubmit}>
            <label className="field"><span>Логин</span><input value={ident} onChange={(e) => setIdent(e.target.value)} autoComplete="username" required /></label>
            <label className="field"><span>Пароль</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
            {error && <p className="err">{error}</p>}
            <button className="btn lg" type="submit" style={{ width: '100%' }}>Войти</button>
          </form>
          <p style={{ marginTop: 14 }}><Link to="/register">Создать аккаунт</Link></p>
        </div>
      </div>
    </PublicShell>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { PublicShell } from '../components/Shells';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
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
          <h1>{t('auth.loginTitle')}</h1>
          <p className="muted">{t('auth.loginHint')}</p>
          <form onSubmit={onSubmit}>
            <label className="field"><span>{t('common.login')}</span><input value={ident} onChange={(e) => setIdent(e.target.value)} autoComplete="username" required /></label>
            <label className="field"><span>{t('common.password')}</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
            {error && <p className="err">{error}</p>}
            <button className="btn lg" type="submit" style={{ width: '100%' }}>{t('common.enter')}</button>
          </form>
          <p style={{ marginTop: 14 }}><Link to="/register">{t('auth.createAccount')}</Link></p>
        </div>
      </div>
    </PublicShell>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { AuthLayout, PublicShell } from '../components/Shells';
import SiteFooter from '../components/SiteFooter';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [ident, setIdent] = useState('');
  const [password, setPassword] = useState('');
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
      <AuthLayout title={t('auth.loginTitle')} hint={t('auth.loginHint')}>
        <form className="cl-auth-card" onSubmit={onSubmit}>
          <label className="field"><span>{t('common.login')}</span><input value={ident} onChange={(e) => setIdent(e.target.value)} autoComplete="username" required /></label>
          <label className="field"><span>{t('common.password')}</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
          {error && <p className="err">{error}</p>}
          <button className="btn lg cl-auth-submit" type="submit">{t('common.enter')}</button>
          <p className="cl-auth-alt">
            <Link to="/register">{t('auth.createAccount')}</Link>
          </p>
        </form>
      </AuthLayout>
      <SiteFooter cta={false} />
    </PublicShell>
  );
}

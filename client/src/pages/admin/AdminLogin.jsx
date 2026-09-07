import { useState } from 'react';
import { BrandLogo } from '../../components/Shells';
import { LangSwitch } from '../../components/LangSwitch';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const { t } = useLang();
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
      <div className="row" style={{ marginBottom: 24, justifyContent: 'space-between' }}>
        <BrandLogo to="/" />
        <LangSwitch />
      </div>
      <div className="card">
        <h1>{t('admin.title')}</h1>
        <p className="muted">{t('admin.hint')}</p>
        <form onSubmit={onSubmit}>
          <label className="field"><span>{t('common.login')}</span><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required /></label>
          <label className="field"><span>{t('common.password')}</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
          {error && <p className="err">{error}</p>}
          <button className="btn lg" type="submit" style={{ width: '100%' }}>{t('common.enter')}</button>
        </form>
      </div>
    </div>
  );
}

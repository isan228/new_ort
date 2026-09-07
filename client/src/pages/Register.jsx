import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { PublicShell } from '../components/Shells';

export default function Register() {
  const { register } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', login: '', password: '', grade: 11, language: lang });
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await register({ ...form, language: lang });
      navigate('/app');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PublicShell>
      <div className="page" style={{ maxWidth: 440 }}>
        <div className="card">
          <h1>{t('auth.registerTitle')}</h1>
          <p className="muted">{t('auth.registerHint')}</p>
          <form onSubmit={onSubmit}>
            <label className="field"><span>{t('common.name')}</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className="field"><span>{t('common.login')}</span><input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} autoComplete="username" required /></label>
            <label className="field"><span>{t('common.password')}</span><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" autoComplete="new-password" required /></label>
            <label className="field">
              <span>{t('auth.grade')}</span>
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}>
                <option value={10}>10</option>
                <option value={11}>11</option>
              </select>
            </label>
            {error && <p className="err">{error}</p>}
            <button className="btn lg" type="submit" style={{ width: '100%' }}>{t('nav.start')}</button>
          </form>
          <p style={{ marginTop: 14 }}><Link to="/login">{t('auth.haveAccount')}</Link></p>
        </div>
      </div>
    </PublicShell>
  );
}

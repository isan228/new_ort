import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicShell } from '../components/Shells';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', grade: 11, language: 'ru' });
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PublicShell>
      <div className="page" style={{ maxWidth: 440 }}>
        <div className="card">
          <h1>Регистрация</h1>
          <p className="muted">Начни подготовку сегодня — бесплатный доступ к базовым тестам.</p>
          <form onSubmit={onSubmit}>
            <label className="field"><span>Имя</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className="field"><span>Email</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" required /></label>
            <label className="field"><span>Пароль</span><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" required /></label>
            <label className="field">
              <span>Класс</span>
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}>
                <option value={10}>10</option>
                <option value={11}>11</option>
              </select>
            </label>
            {error && <p className="err">{error}</p>}
            <button className="btn lg" type="submit" style={{ width: '100%' }}>Начать подготовку</button>
          </form>
          <p style={{ marginTop: 14 }}><Link to="/login">Уже есть аккаунт</Link></p>
        </div>
      </div>
    </PublicShell>
  );
}

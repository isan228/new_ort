import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      navigate('/subscriptions');
    } catch (err) {
      setError(err.message);
    }
  }

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="auth-wrap card">
      <h1 className="serif">Регистрация</h1>
      <form onSubmit={onSubmit}>
        <label className="field">
          <span>Имя</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" required />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input value={form.password} onChange={(e) => set('password', e.target.value)} type="password" required />
        </label>
        <label className="field">
          <span>Класс</span>
          <select value={form.grade} onChange={(e) => set('grade', Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={11}>11</option>
          </select>
        </label>
        <label className="field">
          <span>Язык интерфейса</span>
          <select value={form.language} onChange={(e) => set('language', e.target.value)}>
            <option value="ru">Русский</option>
            <option value="ky">Кыргызча</option>
          </select>
        </label>
        {error && <p className="err">{error}</p>}
        <button className="btn" type="submit">Создать аккаунт</button>
      </form>
      <p><Link to="/login">Уже есть аккаунт</Link></p>
    </div>
  );
}

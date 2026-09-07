import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [lang, setLang] = useState(user?.language || 'ru');
  const [notify, setNotify] = useState(true);

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Настройки</h1>
      <div className="card">
        <label className="field"><span>Имя</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Логин</span><input value={user?.login || ''} disabled /></label>
        <label className="field"><span>Пароль</span><input type="password" placeholder="Новый пароль" /></label>
        <label className="field">
          <span>Язык</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ru">Русский</option>
            <option value="ky">Кыргызча</option>
          </select>
        </label>
        <label className="field"><span><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Уведомления о серии и ежедневной цели</span></label>
        <label className="field"><span><input type="checkbox" checked={theme === 'dark'} onChange={toggle} /> Тёмная тема</span></label>
        <label className="field"><span><input type="checkbox" defaultChecked /> Профиль виден в рейтинге</span></label>
        <button className="btn" type="button">Сохранить</button>
      </div>
    </div>
  );
}

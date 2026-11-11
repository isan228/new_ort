import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { authApi } from '../api/client';

export default function Settings() {
  const { user, setUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { t, lang, setLang } = useLang();

  async function saveName(e) {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    const data = await authApi.updateMe({ name });
    setUser(data.user);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>{t('settings.title')}</h1>
      <form className="card" onSubmit={saveName}>
        <label className="field"><span>{t('common.name')}</span><input name="name" defaultValue={user?.name || ''} /></label>
        <label className="field"><span>{t('common.login')}</span><input value={user?.login || ''} disabled /></label>
        <label className="field"><span>{t('common.password')}</span><input type="password" placeholder={t('settings.newPass')} /></label>
        <label className="field">
          <span>{t('settings.language')}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ru">{t('settings.ru')}</option>
            <option value="ky">{t('settings.ky')}</option>
          </select>
        </label>
        <div className="settings-toggles">
          <label className="settings-toggle"><span>{t('settings.notify')}</span><input type="checkbox" defaultChecked /></label>
          <label className="settings-toggle"><span>{t('settings.dark')}</span><input type="checkbox" checked={theme === 'dark'} onChange={toggle} /></label>
          <label className="settings-toggle"><span>{t('settings.publicRank')}</span><input type="checkbox" defaultChecked /></label>
        </div>
        <button className="btn" type="submit">{t('common.save')}</button>
      </form>
    </div>
  );
}

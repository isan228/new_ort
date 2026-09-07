import { useLang } from '../context/LangContext';

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button type="button" className={lang === 'ru' ? 'on' : ''} onClick={() => setLang('ru')}>RU</button>
      <button type="button" className={lang === 'ky' ? 'on' : ''} onClick={() => setLang('ky')}>KY</button>
    </div>
  );
}

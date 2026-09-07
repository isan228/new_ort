import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { dict } from '../i18n/dict';
import { useAuth } from './AuthContext';
import { authApi, getToken } from '../api/client';

const KEY = 'ortLang';
const LangContext = createContext(null);

function lookup(obj, path) {
  return path.split('.').reduce((cur, key) => (cur == null ? cur : cur[key]), obj);
}

function format(raw, vars) {
  if (typeof raw !== 'string' || !vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? '' : String(vars[key])));
}

export function LangProvider({ children }) {
  const { user, setUser } = useAuth();
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ky' || saved === 'ru') return saved;
    return 'ru';
  });

  useEffect(() => {
    if (user?.language === 'ky' || user?.language === 'ru') {
      setLangState(user.language);
    }
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang === 'ky' ? 'ky' : 'ru';
    document.title = lookup(dict[lang], 'meta.title') || 'ORT.KG';
  }, [lang]);

  const value = useMemo(() => {
    function t(path, vars) {
      const from = lookup(dict[lang], path);
      const fallback = lookup(dict.ru, path);
      const raw = from == null ? fallback : from;
      if (raw == null) return path;
      return format(raw, vars);
    }
    async function setLang(next) {
      const code = next === 'ky' ? 'ky' : 'ru';
      setLangState(code);
      if (getToken()) {
        try {
          const data = await authApi.updateMe({ language: code });
          setUser(data.user);
        } catch {
          /* keep local language even if save failed */
        }
      }
    }
    return {
      lang,
      locale: lang === 'ky' ? 'ky-KG' : 'ru-KG',
      t,
      setLang,
      copy: dict[lang] || dict.ru,
    };
  }, [lang, setUser]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

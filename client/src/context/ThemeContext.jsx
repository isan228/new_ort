import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'ortTheme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    toggle() {
      setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    },
    setTheme,
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

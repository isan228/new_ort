import { createContext, useContext, useMemo, useState } from 'react';

const KEY = 'ortSelectedBank';
const BankContext = createContext(null);

function readBank() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function BankProvider({ children }) {
  const [bank, setBankState] = useState(readBank);

  const value = useMemo(() => ({
    bank,
    setBank(next) {
      setBankState(next);
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    },
  }), [bank]);

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank() {
  return useContext(BankContext);
}

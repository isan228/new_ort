import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, setToken, getToken, ApiError } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    authApi.me()
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    setUser,
    async login(payload) {
      const data = await authApi.login(payload);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    async register(payload) {
      const data = await authApi.register(payload);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    logout() {
      setToken(null);
      setUser(null);
    },
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function isOrtGate(err) {
  return err instanceof ApiError && (err.code === 'ORT_SUBSCRIPTION_REQUIRED' || err.code === 'ORT_AUTH_REQUIRED');
}

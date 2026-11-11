import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(tokenStore.get());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const logout = useCallback(() => {
    tokenStore.set(null);
    setToken(null);
    setUser(null);
  }, []);

  // restore the session after a page refresh (login already gives us the user)
  useEffect(() => {
    if (!token || user) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ user: me }) => setUser(me))
      // only a rejected token ends the session; a network blip or aborted request must not
      .catch((err) => err.status === 401 && logout())
      .finally(() => setLoading(false));
  }, [token, user, logout]);

  useEffect(() => {
    window.addEventListener('auth:expired', logout);
    return () => window.removeEventListener('auth:expired', logout);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    tokenStore.set(res.token);
    setUser(res.user);
    setToken(res.token);
  }, []);

  // UI-only convenience; the backend enforces every permission again.
  const can = useCallback((key) => Boolean(user?.role.permissions.some((p) => p.key === key)), [user]);

  const value = useMemo(() => ({ token, user, loading, login, logout, can }), [token, user, loading, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

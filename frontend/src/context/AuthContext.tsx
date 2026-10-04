import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, resetCsrf, setCsrf } from '../lib/api';

interface AdminUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api<{ user?: AdminUser; admin?: AdminUser } | AdminUser>('/admin/auth/me', { csrf: false });
      setUser(('admin' in response && response.admin) || ('user' in response && response.user) || (response as AdminUser));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api<{ user?: AdminUser; admin?: AdminUser; csrfToken?: string } | AdminUser>('/admin/auth/login', {
      method: 'POST',
      body: { email, password },
      csrf: false,
    });
    if ('csrfToken' in response) setCsrf(response.csrfToken);
    setUser(('admin' in response && response.admin) || ('user' in response && response.user) || (response as AdminUser));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/admin/auth/logout', { method: 'POST' });
    } finally {
      resetCsrf();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
}

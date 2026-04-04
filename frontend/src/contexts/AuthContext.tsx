import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  authAPI,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  type UserMe,
} from '../api/client';

type AuthContextValue = {
  token: string | null;
  user: UserMe | null;
  ready: boolean;
  /** 조회 전용(readonly)이면 false */
  canMutate: boolean;
  /** 직원·식자재만 (매출/정산 메뉴 숨김) */
  isStaffIngredientsOnly: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [user, setUser] = useState<UserMe | null>(null);
  const [ready, setReady] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await authAPI.me();
      setUser(data);
    } catch {
      clearAccessToken();
      setToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    setReady(false);
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    loadMe();
  }, [token, loadMe]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await authAPI.login(username, password);
    setAccessToken(data.access_token);
    setToken(data.access_token);
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setToken(null);
    setUser(null);
  }, []);

  const accessMode = user?.access_mode ?? 'full';
  const canMutate = accessMode !== 'readonly';
  const isStaffIngredientsOnly = accessMode === 'staff_ingredients';

  const value = useMemo(
    () => ({
      token,
      user,
      ready,
      canMutate,
      isStaffIngredientsOnly,
      login,
      logout,
    }),
    [token, user, ready, canMutate, isStaffIngredientsOnly, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다');
  }
  return ctx;
}

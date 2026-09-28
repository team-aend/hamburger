'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export interface AuthUser {
  id: number;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

interface AuthContextValue {
  /** 로그인한 사용자. 비로그인이면 null */
  user: AuthUser | null;
  /** /api/auth/me 확인 중 */
  loading: boolean;
  /** 백엔드에 Google 로그인 설정(환경변수)이 되어 있는지 */
  googleEnabled: boolean;
  /** 개발용 테스트 로그인이 켜져 있는지 (backend DEV_LOGIN=true) */
  devLoginEnabled: boolean;
  /** 현재 화면(또는 returnTo)으로 돌아오도록 로그인 화면으로 이동 */
  goToLogin: (returnTo?: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** 로그인 화면 주소. 로그인 후 returnTo 경로로 돌아온다. */
export function loginHref(returnTo = '/'): string {
  return `/login?${new URLSearchParams({ returnTo }).toString()}`;
}

/** 개발용 테스트 로그인 주소 (account: 1~3) */
export function devLoginHref(account: number, returnTo = '/'): string {
  return `/api/auth/dev-login?${new URLSearchParams({ account: String(account), returnTo }).toString()}`;
}

/** 실제 Google 로그인 시작 주소 (백엔드 → Google → 백엔드 콜백 → returnTo) */
export function googleLoginHref(returnTo = '/'): string {
  return `/api/auth/google?${new URLSearchParams({ returnTo }).toString()}`;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [devLoginEnabled, setDevLoginEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(data.user ?? null);
      setGoogleEnabled(Boolean(data.providers?.google));
      setDevLoginEnabled(Boolean(data.providers?.dev));
    } catch {
      // 백엔드가 꺼져 있어도 로그인은 선택 사항이므로 비로그인 상태로 둔다.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goToLogin = useCallback(
    (returnTo?: string) => {
      const target = returnTo ?? `${pathname}${window.location.search}`;
      router.push(loginHref(target));
    },
    [pathname, router]
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, googleEnabled, devLoginEnabled, goToLogin, logout, refresh }),
    [user, loading, googleEnabled, devLoginEnabled, goToLogin, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.');
  return context;
}

/**
 * 로그인이 필수인 기능의 버튼 핸들러를 감싼다.
 * 비로그인이면 로그인 화면으로 보내고(로그인 후 현재 화면으로 복귀), 로그인 상태면 그대로 실행한다.
 *
 *   const requireLogin = useRequireLogin();
 *   <button onClick={() => requireLogin(() => saveResult())}>결과 저장</button>
 */
export function useRequireLogin() {
  const { user, goToLogin } = useAuth();
  return useCallback(
    (action: () => void) => {
      if (user) action();
      else goToLogin();
    },
    [user, goToLogin]
  );
}

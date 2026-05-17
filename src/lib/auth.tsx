"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

// ============================================================
// Types
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  ai_calls_count: number;
  ai_calls_limit: number;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  apiFetch: <T = unknown>(
    path: string,
    options?: RequestInit
  ) => Promise<T>;
}

// ============================================================
// Constants
// ============================================================

const API_BASE = "/api/v1";
const API_PORT = 3030;
const ACCESS_TOKEN_KEY = "gidede_access_token";
const REFRESH_TOKEN_KEY = "gidede_refresh_token";
const TOKEN_EXPIRY_BUFFER_MS = 60_000; // Refresh 1 min before expiry

// ============================================================
// Helpers
// ============================================================

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Build a URL that goes through the Caddy gateway.
 * If the path starts with /api/v1, append ?XTransformPort=3030
 * so Caddy forwards to the FastAPI backend.
 */
function apiUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${separator}XTransformPort=${API_PORT}`;
}

// ============================================================
// Context
// ============================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================
// Provider
// ============================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const router = useRouter();

  // ----------------------------------------------------------
  // Fetch the current user from /auth/me
  // ----------------------------------------------------------
  const fetchMe = useCallback(
    async (token?: string): Promise<User | null> => {
      const accessToken = token || getAccessToken();
      if (!accessToken) return null;

      try {
        const res = await fetch(apiUrl("/auth/me"), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!res.ok) return null;
        const user: User = await res.json();
        return user;
      } catch {
        return null;
      }
    },
    []
  );

  // ----------------------------------------------------------
  // Refresh the access token
  // ----------------------------------------------------------
  const refreshToken = useCallback(async (): Promise<string | null> => {
    // Prevent concurrent refresh calls
    if (isRefreshingRef.current) return getAccessToken();

    const rt = getRefreshToken();
    if (!rt) return null;

    isRefreshingRef.current = true;
    try {
      const res = await fetch(apiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });

      if (!res.ok) {
        clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return null;
      }

      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);

      setState((prev) => ({
        ...prev,
        user: data.user ?? prev.user,
        isAuthenticated: true,
      }));

      scheduleRefresh(data.expires_in);
      return data.access_token;
    } catch {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // ----------------------------------------------------------
  // Schedule an automatic refresh before the token expires
  // ----------------------------------------------------------
  function scheduleRefresh(expiresIn: number) {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    const delay = Math.max(expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS, 5000);
    refreshTimerRef.current = setTimeout(() => {
      refreshToken();
    }, delay);
  }

  // ----------------------------------------------------------
  // Login
  // ----------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.detail || "Ошибка входа. Проверьте email и пароль."
        );
      }

      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      scheduleRefresh(data.expires_in);

      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
      });

      router.push("/");
    },
    [router, refreshToken]
  );

  // ----------------------------------------------------------
  // Register
  // ----------------------------------------------------------
  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const body: Record<string, string> = { email, password };
      if (name) body.name = name;

      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.detail || "Ошибка регистрации. Попробуйте снова."
        );
      }

      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      scheduleRefresh(data.expires_in);

      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
      });

      router.push("/");
    },
    [router, refreshToken]
  );

  // ----------------------------------------------------------
  // Logout
  // ----------------------------------------------------------
  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    if (rt) {
      try {
        await fetch(apiUrl("/auth/logout"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: rt }),
        });
      } catch {
        // Ignore — clear local state anyway
      }
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.push("/login");
  }, [router]);

  // ----------------------------------------------------------
  // Auth-aware fetch helper
  // ----------------------------------------------------------
  const apiFetch = useCallback(
    async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
      let accessToken = getAccessToken();

      // Try to refresh if we have no access token but have a refresh token
      if (!accessToken && getRefreshToken()) {
        accessToken = await refreshToken();
      }

      const headers = new Headers(options.headers);
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
      if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(apiUrl(path), {
        ...options,
        headers,
      });

      // Handle 401 — try to refresh once
      if (res.status === 401) {
        const newToken = await refreshToken();
        if (newToken) {
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set("Authorization", `Bearer ${newToken}`);
          const retryRes = await fetch(apiUrl(path), {
            ...options,
            headers: retryHeaders,
          });
          if (retryRes.status === 401) {
            clearTokens();
            setState({ user: null, isLoading: false, isAuthenticated: false });
            router.push("/login");
            throw new Error("Сессия истекла. Войдите заново.");
          }
          return retryRes.json();
        }

        clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
        router.push("/login");
        throw new Error("Сессия истекла. Войдите заново.");
      }

      return res.json();
    },
    [refreshToken, router]
  );

  // ----------------------------------------------------------
  // Initialise on mount — check for existing tokens
  // ----------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      const at = getAccessToken();
      const rt = getRefreshToken();

      if (at) {
        const user = await fetchMe(at);
        if (user) {
          setState({ user, isLoading: false, isAuthenticated: true });
          // Schedule a refresh — default 30 min token
          scheduleRefresh(30 * 60);
          return;
        }
      }

      // Access token invalid but refresh token exists
      if (rt) {
        const newAt = await refreshToken();
        if (newAt) {
          const user = await fetchMe(newAt);
          if (user) {
            setState({ user, isLoading: false, isAuthenticated: true });
            return;
          }
        }
      }

      setState({ user: null, isLoading: false, isAuthenticated: false });
    };

    init();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // ----------------------------------------------------------
  // Provide context
  // ----------------------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshToken,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

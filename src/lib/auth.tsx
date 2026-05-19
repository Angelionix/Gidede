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
  // Auth-aware fetch helper with timeout + retry (4.E.4)
  // ----------------------------------------------------------

  const API_TIMEOUT_MS = 30_000; // 30s default timeout
  const API_MAX_RETRIES = 2; // 2 retries (3 total attempts) for network errors
  const API_RETRY_DELAY_MS = 1_000; // 1s base delay, doubles each retry

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

      // 4.E.4: Retry loop for network errors with exponential backoff
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
        try {
          // 4.E.4: AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

          // Merge signal: respect caller's signal OR our timeout signal
          const mergedSignal = options.signal
            ? AbortSignal.any([options.signal, controller.signal])
            : controller.signal;

          const res = await fetch(apiUrl(path), {
            ...options,
            headers,
            signal: mergedSignal,
          });

          clearTimeout(timeoutId);

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

          // Handle server errors (5xx) — retry
          if (res.status >= 500 && attempt < API_MAX_RETRIES) {
            lastError = new Error(`Сервер вернул ошибку ${res.status}. Повторная попытка...`);
            const delay = API_RETRY_DELAY_MS * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          // Handle 422 with detailed error message
          if (res.status === 422) {
            const errData = await res.json().catch(() => ({}));
            const details = errData.detail
              ? (typeof errData.detail === "string"
                ? errData.detail
                : Array.isArray(errData.detail)
                  ? errData.detail.map((d: { msg?: string; loc?: string[] }) => `${d.loc?.join(".") || "field"}: ${d.msg || "invalid"}`).join("; ")
                  : JSON.stringify(errData.detail))
              : "Ошибка валидации данных";
            throw new Error(`Ошибка валидации: ${details}`);
          }

          // Handle other client errors (4xx)
          if (res.status >= 400) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || `Ошибка запроса (${res.status})`);
          }

          return res.json();
        } catch (err) {
          // Timeout error
          if (err instanceof DOMException && err.name === "AbortError") {
            lastError = new Error("Превышено время ожидания запроса. Попробуйте снова.");
            if (attempt < API_MAX_RETRIES) {
              const delay = API_RETRY_DELAY_MS * Math.pow(2, attempt);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
          }

          // Network error (fetch failed entirely)
          if (err instanceof TypeError && err.message.includes("fetch")) {
            lastError = new Error("Не удалось подключиться к серверу. Проверьте подключение к интернету.");
            if (attempt < API_MAX_RETRIES) {
              const delay = API_RETRY_DELAY_MS * Math.pow(2, attempt);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
          }

          // Non-retryable error — throw immediately
          if (err instanceof Error && (
            err.message.includes("Сессия истекла") ||
            err.message.includes("Ошибка валидации") ||
            err.message.includes("Ошибка запроса")
          )) {
            throw err;
          }

          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < API_MAX_RETRIES) {
            const delay = API_RETRY_DELAY_MS * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }
      }

      // All retries exhausted
      throw lastError || new Error("Запрос не удался после нескольких попыток.");
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

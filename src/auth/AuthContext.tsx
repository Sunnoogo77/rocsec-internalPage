import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, HttpError } from "@/api/client";
import type { User } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

interface AuthState {
  user: User | null;
  loading: boolean;
  passwordChanged: boolean;
  login: (
    username: string,
    password: string,
    otpToken?: string,
  ) => Promise<{
    requiresOtp?: boolean;
    requiresPasswordChange?: boolean;
    requiresMfaSetup?: boolean;
  }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  invalidateSession: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const sessionVersion = useRef(0);

  const invalidateSession = useCallback(() => {
    sessionVersion.current += 1;
    setUser(null);
    setLoading(false);
    cache.clear();
  }, [cache]);

  const refresh = useCallback(async () => {
    const version = sessionVersion.current;
    try {
      const me = await api.get<User>("/auth/me/");
      if (version === sessionVersion.current) setUser(me);
    } catch {
      if (version === sessionVersion.current) setUser(null);
    } finally {
      if (version === sessionVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void api.ensureCsrf().catch(() => undefined);
    void refresh();
  }, [refresh]);

  const login: AuthState["login"] = useCallback(
    async (username, password, otpToken) => {
      await api.ensureCsrf();
      try {
        const me = await api.post<User>("/auth/login/", {
          username,
          password,
          otp_token: otpToken ?? "",
        });
        await api.ensureCsrf();
        sessionVersion.current += 1;
        cache.removeQueries({ queryKey: ["mfa-assurance"] });
        setPasswordChanged(false);
        setUser(me);
        setLoading(false);
        return {
          requiresPasswordChange: me.must_change_password,
          requiresMfaSetup: me.mfa_setup_required,
        };
      } catch (err) {
        if (err instanceof HttpError) {
          const requiresOtp = (err.details as { requires_otp?: boolean } | undefined)?.requires_otp;
          if (requiresOtp) {
            return { requiresOtp: true };
          }
        }
        throw err;
      }
    },
    [cache],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      /* ignore */
    }
    invalidateSession();
  }, [invalidateSession]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api.post("/auth/password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordChanged(true);
      invalidateSession();
    },
    [invalidateSession],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      invalidateSession,
      changePassword,
      passwordChanged,
    }),
    [user, loading, login, logout, refresh, invalidateSession, changePassword, passwordChanged],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être appelé sous <AuthProvider>");
  }
  return ctx;
}

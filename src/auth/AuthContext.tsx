import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  ) => Promise<{ requiresOtp?: boolean; requiresPasswordChange?: boolean }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me/");
      setUser(me);
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        setUser(null);
      } else {
        // Pour les erreurs imprévues (réseau, serveur), on n'efface pas la session locale.
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void api.ensureCsrf().catch(() => undefined);
    void refresh();
  }, [refresh]);

  const login: AuthState["login"] = useCallback(async (username, password, otpToken) => {
    await api.ensureCsrf();
    try {
      const me = await api.post<User>("/auth/login/", {
        username,
        password,
        otp_token: otpToken ?? "",
      });
      await api.ensureCsrf();
      setPasswordChanged(false);
      setUser(me);
      return { requiresPasswordChange: me.must_change_password };
    } catch (err) {
      if (err instanceof HttpError) {
        const requiresOtp = (err.details as { requires_otp?: boolean } | undefined)?.requires_otp;
        if (requiresOtp) {
          return { requiresOtp: true };
        }
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      /* ignore */
    }
    setUser(null);
    cache.clear();
  }, [cache]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api.post("/auth/password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordChanged(true);
      setUser(null);
      cache.clear();
    },
    [cache],
  );

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, refresh, changePassword, passwordChanged }),
    [user, loading, login, logout, refresh, changePassword, passwordChanged],
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

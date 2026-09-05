import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, HttpError } from "@/api/client";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, otpToken?: string) => Promise<{ requiresOtp?: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const login: AuthState["login"] = useCallback(
    async (email, password, otpToken) => {
      await api.ensureCsrf();
      try {
        const me = await api.post<User>("/auth/login/", {
          email,
          password,
          otp_token: otpToken ?? "",
        });
        await api.ensureCsrf();
        setUser(me);
        return {};
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
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
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

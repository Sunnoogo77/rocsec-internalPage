import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  allowPasswordChange?: boolean;
}

export function ProtectedRoute({ children, allowPasswordChange = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!user) {
    const from = allowPasswordChange
      ? (location.state as { from?: string } | null)?.from ?? "/"
      : location.pathname;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  if (user.must_change_password && !allowPasswordChange) {
    return <Navigate to="/changer-mot-de-passe" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/api/client";
import { Button } from "@/components/ui";
import buttonStyles from "@/components/ui/Button.module.css";

export function useWorkflowAccess(
  item?: { cree_par: string | null; modifie_par: string | null } | null,
) {
  const { user } = useAuth();
  const validator = Boolean(user?.is_superuser || user?.role === "validateur");
  const own = Boolean(user && item && [item.cree_par, item.modifie_par].includes(user.id));
  const requiresMfa = Boolean(user?.is_superuser || user?.mfa_required || user?.has_2fa);
  const assurance = useQuery({
    queryKey: ["mfa-assurance"],
    queryFn: () => api.get<{ is_recent: boolean; seconds_remaining: number }>("/auth/2fa/step-up/"),
    enabled: validator && requiresMfa && !user?.mfa_setup_required,
    staleTime: Infinity,
  });
  // The server checks the login session. There is no per-action timer or code.
  const recent = !requiresMfa || (assurance.isSuccess && assurance.data.is_recent);
  return {
    validator,
    own,
    requiresOtherReviewer: false,
    recent,
    canValidate: validator && recent,
    canManage: validator && recent,
    assurance,
  };
}

export function IdentityCheck() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = `${location.pathname}${location.search}`;
  if (!user?.has_2fa) {
    return (
      <Link
        className={`${buttonStyles.btn} ${buttonStyles.secondary} ${buttonStyles.sm}`}
        style={{ whiteSpace: "normal", lineHeight: 1.4 }}
        to="/reglages#securite"
        state={{ returnTo }}
      >
        Configurer la double authentification
      </Link>
    );
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        await logout();
        navigate("/login", {
          replace: true,
          state: {
            from: returnTo,
            securityNotice:
              "Reconnectez-vous avec votre code d’authentification. Cette vérification restera valable pendant toute votre connexion.",
          },
        });
      }}
    >
      Vérifier ma connexion
    </Button>
  );
}

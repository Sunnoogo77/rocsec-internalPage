import { Link, useLocation } from "react-router-dom";
import { HttpError } from "@/api/client";
import styles from "./ActionError.module.css";

const fieldNames: Record<string, string> = {
  username: "Nom d’utilisateur",
  password: "Mot de passe",
  current_password: "Mot de passe actuel",
  new_password: "Nouveau mot de passe",
  first_name: "Prénom",
  last_name: "Nom",
  nom: "Nom",
  prenom: "Prénom",
  role: "Rôle",
  roles: "Rôles",
  token: "Code de vérification",
};

export function isMfaRequired(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (error.code === "mfa_required" ||
      error.details?.code === "mfa_required" ||
      /vérification MFA récente|double authentification.*requise/i.test(error.message))
  );
}

function validationMessages(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  if (Array.isArray(details))
    return details.filter((item): item is string => typeof item === "string");
  return Object.entries(details).flatMap(([field, value]) => {
    if (["code", "status", "requires_otp"].includes(field)) return [];
    const messages = typeof value === "string" ? [value] : validationMessages(value);
    const label = fieldNames[field];
    return messages.map((message) => (label ? `${label} : ${message}` : message));
  });
}

export function ActionError({
  error,
  title = "L’action n’a pas abouti.",
  fallback = "Impossible de joindre le service. Réessayez dans un instant.",
  className,
  showMfaAction = true,
}: {
  error: unknown;
  title?: string;
  fallback?: string;
  className?: string;
  showMfaAction?: boolean;
}) {
  const location = useLocation();
  if (!error) return null;
  const mfa = isMfaRequired(error);
  const details =
    error instanceof HttpError && error.status < 500 ? validationMessages(error.details) : [];
  const message = mfa
    ? "Pour continuer, confirmez votre identité avec le code de votre application d’authentification. Si elle n’est pas encore configurée, Mon compte vous guide étape par étape."
    : error instanceof HttpError && error.status < 500
      ? error.message
      : fallback;
  return (
    <div role="alert" className={[styles.notice, className].filter(Boolean).join(" ")}>
      <div className={styles.content}>
        <strong>{mfa ? "Une vérification de votre identité est nécessaire." : title}</strong>
        <p>{message}</p>
        {details.length > 0 && (
          <ul>
            {[...new Set(details)].map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      {mfa && showMfaAction && (
        <Link
          className={styles.action}
          to="/reglages#securite"
          state={{ returnTo: `${location.pathname}${location.search}` }}
        >
          Vérifier mon identité
        </Link>
      )}
    </div>
  );
}

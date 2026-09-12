import { startTransition } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { HttpError } from "@/api/client";
import { FormValidationError } from "@/lib/formValidation";
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
  date_culte: "Date et heure du culte",
  heure_culte: "Heure du culte",
  type_culte: "Type de culte",
  predicateur: "Prédicateur",
  titre: "Titre",
  traductions: "Contenu",
  youtube_url: "Lien YouTube",
  passages: "Passages bibliques",
  reference: "Référence biblique",
  texte: "Texte",
  citations_branham: "Citations Branham",
  source: "Source",
  plan: "Plan du message",
  numero_dans_serie: "Numéro dans la série",
  date_debut: "Date de début",
  date_fin: "Date de fin",
  texte_fr: "Témoignage en français",
  nom_affiche: "Nom affiché",
  titre_message: "Titre du vlog",
  titre_suffix: "Complément du titre",
  pitch_message: "Présentation du message",
  serie: "Série",
  predicateur_libelle: "Nom du prédicateur affiché",
  replay_url: "Lien du replay",
  verset_reference: "Référence du verset",
  verset_texte: "Texte du verset",
  fil_paragraphe1: "Fil conducteur — premier paragraphe",
  fil_paragraphe2: "Fil conducteur — second paragraphe",
  fil_versets: "Versets du fil conducteur",
  temoignage_auteur: "Auteur du témoignage",
  temoignage_texte: "Texte du témoignage",
  corps: "Texte du témoignage",
  quote_text: "Texte de la citation",
  famille: "Famille du cantique",
  interpretes: "Interprètes",
  date_enregistrement: "Date d’enregistrement",
  lieu: "Lieu",
};

export function isMfaRequired(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (["mfa_required", "mfa_setup_required"].includes(error.code) ||
      ["mfa_required", "mfa_setup_required"].includes(String(error.details?.code)) ||
      /vérification MFA récente|double authentification.*requise/i.test(error.message))
  );
}

function validationMessages(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  if (Array.isArray(details))
    return details.flatMap((item, index) =>
      typeof item === "string"
        ? [item]
        : validationMessages(item).map((message) => `Élément ${index + 1} · ${message}`),
    );
  return Object.entries(details).flatMap(([field, value]) => {
    if (["code", "status", "requires_otp"].includes(field)) return [];
    const messages = typeof value === "string" ? (value ? [value] : []) : validationMessages(value);
    const label =
      fieldNames[field] ??
      (["detail", "message", "non_field_errors", "fr", "en"].includes(field)
        ? ""
        : field.replaceAll("_", " "));
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
  const navigate = useNavigate();
  const { invalidateSession } = useAuth();
  if (!error) return null;
  const sessionExpired = error instanceof HttpError && error.code === "authentication_required";
  const mfa = isMfaRequired(error);
  const details =
    error instanceof FormValidationError
      ? validationMessages(error.fields)
      : error instanceof HttpError && error.status < 500
        ? validationMessages(error.details)
        : [];
  const message = sessionExpired
    ? "Votre session a expiré ou vos accès ont été modifiés. Reconnectez-vous pour continuer."
    : mfa
      ? "Votre connexion doit être vérifiée. Ouvrez Mon compte pour configurer la double authentification ou vous reconnecter. Ensuite, un seul code sera demandé à chaque connexion."
      : error instanceof FormValidationError || (error instanceof HttpError && error.status < 500)
        ? error.message
        : fallback;
  return (
    <div role="alert" className={[styles.notice, className].filter(Boolean).join(" ")}>
      <div className={styles.content}>
        <strong>
          {sessionExpired
            ? "Reconnectez-vous à votre compte."
            : mfa
              ? "Une vérification de votre identité est nécessaire."
              : title}
        </strong>
        <p>{message}</p>
        {details.length > 0 && (
          <ul>
            {[...new Set(details)].map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      {sessionExpired && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            startTransition(() => {
              invalidateSession();
              navigate("/login", {
                replace: true,
                state: { from: `${location.pathname}${location.search}` },
              });
            });
          }}
        >
          Se reconnecter
        </button>
      )}
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

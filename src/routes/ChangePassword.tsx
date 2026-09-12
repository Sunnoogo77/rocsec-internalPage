import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, HttpError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Input } from "@/components/ui";
import styles from "./ChangePassword.module.css";

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const assurance = useQuery({
    queryKey: ["mfa-assurance"],
    enabled: Boolean(user?.has_2fa),
    queryFn: () => api.get<{ is_recent: boolean }>("/auth/2fa/step-up/"),
    refetchInterval: 30_000,
  });
  const needsOtp = user?.has_2fa && !assurance.data?.is_recent;

  if (!user?.must_change_password) return <Navigate to="/" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choisissez un mot de passe différent du mot de passe temporaire.");
      return;
    }
    setSubmitting(true);
    try {
      if (needsOtp) {
        await api.post("/auth/2fa/step-up/", { token: otpToken });
        setOtpToken("");
        await assurance.refetch();
      }
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      navigate("/login", { replace: true, state: { passwordChanged: true, from } });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Le changement a échoué. Réessayez.");
      // A verification can expire while the form is open. Refresh before the next attempt.
      if (user.has_2fa) void assurance.refetch();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="password-title">
        <header className={styles.header}>
          <img src="/logo-rst-white.svg" alt="Logo Roc Séculaire Tabernacle" />
          <p className={styles.brand}>Roc Séculaire Tabernacle</p>
          <h1 id="password-title">Choisissez votre mot de passe</h1>
          <p>
            Bonjour {user.first_name || user.username}. Remplacez le mot de passe temporaire
            transmis par votre administrateur pour accéder à votre espace de gestion.
          </p>
        </header>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Mot de passe temporaire"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            maxLength={256}
            required
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={12}
            maxLength={256}
            required
            help="Au moins 12 caractères. Choisissez un mot de passe que vous seul connaissez."
          />
          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            minLength={12}
            maxLength={256}
            required
          />
          {needsOtp && (
            <Input
              label="Code de vérification"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otpToken}
              onChange={(event) => setOtpToken(event.target.value)}
              required
              help="Saisissez le prochain code de votre application d’authentification, différent de celui utilisé pour vous connecter."
            />
          )}
          <Button
            type="submit"
            size="lg"
            variant="primary"
            disabled={submitting || (user.has_2fa && assurance.isLoading)}
          >
            {submitting ? "Enregistrement…" : "Enregistrer et me reconnecter"}
          </Button>
        </form>
        <Button variant="ghost" disabled={submitting} onClick={() => void logout()}>
          Me déconnecter
        </Button>
      </section>
    </main>
  );
}

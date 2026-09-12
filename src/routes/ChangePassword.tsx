import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { HttpError } from "@/api/client";
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      navigate("/login", { replace: true, state: { passwordChanged: true, from } });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Le changement a échoué. Réessayez.");
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
          <Button type="submit" size="lg" variant="primary" disabled={submitting}>
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

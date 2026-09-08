import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button, Input } from "@/components/ui";
import { HttpError } from "@/api";
import styles from "./Login.module.css";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, otpRequired ? otpToken : undefined);
      if (result.requiresOtp) {
        setOtpRequired(true);
        setSubmitting(false);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message);
      } else {
        setError("Connexion impossible. Réessayez plus tard.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.intro} aria-label="Roc Séculaire">
        <span className={styles.eyebrow}>ROC SÉCULAIRE TABERNACLE</span>
        <h1>
          Un espace pour
          <br />
          servir ensemble.
        </h1>
        <p>
          Préparez les cultes, partagez les cantiques et faites vivre les nouvelles de notre
          assemblée.
        </p>
        <div className={styles.introFoot}>
          ESPACE DE L’ÉQUIPE <span>•</span> ACCÈS PERSONNEL
        </div>
      </section>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>R</span>
          <div>
            <div className={styles.brandTitle}>Roc Séculaire</div>
            <div className={styles.brandTag}>Espace de gestion</div>
          </div>
        </div>

        <div className={styles.welcome}>
          <h2>Bienvenue</h2>
          <p>Connectez-vous à votre espace de travail.</p>
        </div>
        {error ? (
          <div role="alert" className={styles.alert}>
            {error}
          </div>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="vous@rocseculaire.fr"
          />
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
          />
          {otpRequired ? (
            <Input
              label="Code TOTP"
              help="Code à 6 chiffres de votre application d'authentification"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              value={otpToken}
              onChange={(event) => setOtpToken(event.target.value)}
              required
              maxLength={8}
            />
          ) : null}
          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="lg" disabled={submitting}>
              {submitting ? "Connexion…" : "Se connecter"}
            </Button>
          </div>
        </form>

        <p className={styles.helper}>
          Mot de passe oublié&nbsp;? Contactez l'administrateur du site.
        </p>
      </div>
    </div>
  );
}

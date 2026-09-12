import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button, Input } from "@/components/ui";
import { HttpError } from "@/api";
import styles from "./Login.module.css";

const portraits = [
  { src: "/images/jesus.jpg", name: "Jésus-Christ" },
  { src: "/images/wmb-portrait.jpeg", name: "William Marrion Branham" },
];

function Portraits() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((current) => (current + 1) % portraits.length);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);
  return (
    <section className={styles.portraits} aria-label="Portraits de l’assemblée">
      {portraits.map((portrait, index) => (
        <img
          key={portrait.src}
          src={portrait.src}
          alt={portrait.name}
          aria-hidden={index !== active}
          className={`${styles.portrait} ${index === active ? styles.visible : ""}`}
        />
      ))}
      <div className={styles.portraitCaption}>
        <span>{portraits[active].name}</span>
        <div className={styles.portraitControls}>
          <button
            type="button"
            onClick={() => setActive((current) => (current + 1) % portraits.length)}
            aria-label="Afficher l’autre portrait"
          >
            ↔
          </button>
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setPaused((current) => !current)}
              aria-label={paused ? "Reprendre le défilement" : "Mettre le défilement en pause"}
            >
              {paused ? "Reprendre" : "Pause"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [username, setUsername] = useState("");
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
      const result = await login(username, password, otpRequired ? otpToken : undefined);
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
      <div className={styles.panel}>
        <Portraits />
        <div className={styles.card}>
          <div className={styles.brand}>
            <img className={styles.logo} src="/logo-rst.png" alt="Logo Roc Séculaire Tabernacle" />
            <div>
              <div className={styles.brandTitle}>Roc Séculaire Tabernacle</div>
              <div className={styles.brandTag}>Espace de gestion</div>
            </div>
          </div>

          <div className={styles.welcome}>
            <h1>Bienvenue</h1>
            <p>Connectez-vous à votre espace de travail.</p>
          </div>
          {error ? (
            <div role="alert" className={styles.alert}>
              {error}
            </div>
          ) : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            <Input
              label="Nom d’utilisateur"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={150}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              placeholder="frere.jean"
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
    </div>
  );
}

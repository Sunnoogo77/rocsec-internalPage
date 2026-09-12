import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button, Input } from "@/components/ui";
import { HttpError } from "@/api";
import styles from "./Login.module.css";

const portraits = [
  { src: "/images/jesus-login.png", name: "Jésus-Christ" },
  { src: "/images/wmb-portrait.jpeg", name: "William Marrion Branham" },
];

function Portraits() {
  const [active, setActive] = useState(0);
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
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((current) => (current + 1) % portraits.length);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);
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
    </section>
  );
}

export function LoginPage() {
  const { user, login, passwordChanged } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; passwordChanged?: boolean } | null;
  const from = state?.from && state.from !== "/changer-mot-de-passe" ? state.from : "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return (
      <Navigate
        to={user.must_change_password ? "/changer-mot-de-passe" : from}
        state={{ from }}
        replace
      />
    );
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
      navigate(result.requiresPasswordChange ? "/changer-mot-de-passe" : from, {
        replace: true,
        state: { from },
      });
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
    <main className={styles.page}>
      <Portraits />
      <section className={styles.formPanel} aria-label="Connexion">
        <div className={styles.card}>
          <div className={styles.brand}>
            <img
              className={styles.logo}
              src="/logo-rst-white.svg"
              alt="Logo Roc Séculaire Tabernacle"
            />
            <div className={styles.brandTitle}>Roc Séculaire Tabernacle</div>
          </div>

          <div className={styles.welcome}>
            <h1>Bienvenue</h1>
            <p>Connectez-vous à votre espace de gestion.</p>
          </div>
          {(state?.passwordChanged || passwordChanged) && (
            <p role="status" className={styles.notice}>
              Votre mot de passe a été modifié. Connectez-vous avec votre nouveau mot de passe.
            </p>
          )}
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
            />
            <div className={styles.passwordField}>
              <Input
                id="login-password"
                label="Mot de passe"
                type={passwordVisible ? "text" : "password"}
                className={styles.passwordInput}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={12}
                maxLength={256}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                aria-label={
                  passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
                aria-controls="login-password"
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
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
      </section>
    </main>
  );
}

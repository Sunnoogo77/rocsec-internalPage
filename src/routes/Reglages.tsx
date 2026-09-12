import { startTransition, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input } from "@/components/ui";
import { ActionError } from "@/components/ui/ActionError";
import { accountsApi } from "@/api";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import styles from "./Reglages.module.css";
import { IdentityCheck } from "@/components/forms/WorkflowAccess";

export function ReglagesPage() {
  const { user, refresh, invalidateSession, changePassword } = useAuth();
  const cache = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedReturn = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo =
    typeof requestedReturn === "string" &&
    /^\/(?!\/)/.test(requestedReturn) &&
    !requestedReturn.startsWith("/reglages")
      ? requestedReturn
      : null;
  const [enrolment, setEnrolment] = useState<{ secret_b32: string; otpauth_url: string } | null>(
    null,
  );
  const enrolmentGeneration = useRef(0);
  const mounted = useRef(true);
  const [token, setToken] = useState("");
  const [enrolmentStatus, setEnrolmentStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const assurance = useQuery({
    queryKey: ["mfa-assurance"],
    queryFn: () => api.get<{ is_recent: boolean; seconds_remaining: number }>("/auth/2fa/step-up/"),
    enabled: Boolean(user?.has_2fa),
    staleTime: Infinity,
  });
  const required = Boolean(user?.is_superuser || user?.mfa_required);
  const recent = assurance.isSuccess && assurance.data.is_recent;
  useEffect(() => {
    if (location.hash === "#securite") {
      document.getElementById("securite")?.focus();
    }
  }, [location.hash]);
  const enable = useMutation({
    mutationFn: async () => {
      const generation = ++enrolmentGeneration.current;
      const result = await accountsApi.enable2fa();
      if (mounted.current && generation === enrolmentGeneration.current) {
        setEnrolment(result);
        setCopyStatus("");
      }
      // Do not retain the secret in React Query's mutation data.
    },
    gcTime: 0,
  });
  const resetEnable = enable.reset;
  useEffect(() => {
    mounted.current = true;
    const clearEnrolment = () => {
      enrolmentGeneration.current += 1;
      setEnrolment(null);
      setToken("");
      setCopyStatus("");
      resetEnable();
    };
    window.addEventListener("pagehide", clearEnrolment);
    return () => {
      mounted.current = false;
      enrolmentGeneration.current += 1;
      resetEnable();
      window.removeEventListener("pagehide", clearEnrolment);
    };
  }, [resetEnable]);
  const reconnect = (securityNotice: string) => {
    enrolmentGeneration.current += 1;
    enable.reset();
    setEnrolment(null);
    setToken("");
    setCopyStatus("");
    // These endpoints have already ended the server session. No /me/ request
    // should race with the user's next login.
    // BrowserRouter navigations use a transition. Update auth in that same
    // transition so ProtectedRoute cannot redirect before the notice arrives.
    startTransition(() => {
      invalidateSession();
      navigate("/login", {
        replace: true,
        state: { from: "/reglages#securite", returnTo, securityNotice },
      });
    });
  };
  const verify = useMutation({
    mutationFn: () => accountsApi.verify2fa(token),
    onSuccess: async () => {
      enrolmentGeneration.current += 1;
      enable.reset();
      setEnrolment(null);
      setToken("");
      setCopyStatus("");
      await refresh();
      await cache.invalidateQueries({ queryKey: ["mfa-assurance"] });
      setEnrolmentStatus(
        "La double authentification est activée. Votre connexion est vérifiée : vous pouvez commencer à travailler.",
      );
    },
  });
  const disable = useMutation({
    mutationFn: accountsApi.disable2fa,
    onSuccess: () =>
      reconnect(
        "La double authentification est désactivée. Reconnectez-vous avec votre mot de passe.",
      ),
  });
  const password = useMutation({
    mutationFn: () => changePassword(oldPassword, newPassword),
    onSuccess: () => {
      setOldPassword("");
      setNewPassword("");
    },
  });
  const copyKey = async () => {
    if (!enrolment) return;
    try {
      await navigator.clipboard.writeText(enrolment.secret_b32);
      setCopyStatus("Clé copiée. Collez-la dans votre application d’authentification.");
    } catch {
      setCopyStatus(
        "La copie automatique est indisponible. Sélectionnez la clé ci-dessus pour la copier.",
      );
    }
  };
  return (
    <>
      <Breadcrumb items={[{ label: "Réglages" }]} />
      <PageHead title="Mon compte" lede="Vos accès et la sécurité de votre espace de travail." />
      <PageBody>
        <div className={styles.workspace}>
          <section
            id="securite"
            tabIndex={-1}
            aria-labelledby="security-title"
            className={styles.security}
          >
            <div className={styles.sectionHead}>
              <div>
                <h2 id="security-title">Double authentification</h2>
                <p>
                  En plus de votre mot de passe, un code à six chiffres sur votre téléphone protège
                  votre compte.
                </p>
              </div>
              <span className={user?.has_2fa ? styles.enabled : styles.pending}>
                {user?.has_2fa ? "Activée" : required ? "À configurer" : "Facultative"}
              </span>
            </div>
            {user?.mfa_setup_required && (
              <p role="status" className="securityNotice">
                La double authentification est obligatoire pour votre compte. Configurez-la
                ci-dessous pour accéder à votre espace de travail.
              </p>
            )}
            {enrolmentStatus && (
              <p role="status" className={styles.success}>
                {enrolmentStatus}
              </p>
            )}
            {!user?.has_2fa ? (
              <div className="settingsForm">
                <p>
                  {required
                    ? "Cette protection est obligatoire pour votre compte."
                    : "Cette protection est facultative. Vous pouvez l’activer pour sécuriser votre compte."}{" "}
                  La configuration ne se fait qu’une fois ; ensuite, un code sera demandé uniquement
                  à chaque connexion.
                </p>
                {!enrolment ? (
                  <>
                    <p>
                      Prenez votre téléphone et ouvrez votre application d’authentification. Elle
                      ajoutera un compte « RST Admin » et générera les codes de connexion.
                    </p>
                    <p>
                      Vous n’en avez pas encore ? Installez par exemple{" "}
                      <a
                        href="https://support.microsoft.com/fr-fr/authenticator/download-microsoft-authenticator"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Microsoft Authenticator
                      </a>{" "}
                      depuis l’App Store ou le Play Store de votre téléphone, puis revenez ici.
                    </p>
                    <ActionError
                      error={enable.error}
                      title="La configuration n’a pas pu démarrer."
                      showMfaAction={false}
                    />
                    <Button
                      variant="primary"
                      disabled={enable.isPending}
                      onClick={() => {
                        enable.reset();
                        enable.mutate();
                      }}
                    >
                      {enable.isPending ? "Préparation…" : "Configurer la double authentification"}
                    </Button>
                  </>
                ) : (
                  <form
                    className="settingsForm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      verify.mutate();
                    }}
                  >
                    <ol className={styles.steps}>
                      <li>
                        <strong>Ouvrez votre application d’authentification.</strong>
                        <p>
                          Sur votre téléphone, choisissez Ajouter un compte, puis Scanner un QR
                          code. Dans Microsoft Authenticator, choisissez « Autre compte ».
                        </p>
                      </li>
                      <li>
                        <strong>Scannez ce QR code avec l’application.</strong>
                        <div className={styles.qr}>
                          <QRCodeSVG
                            value={enrolment.otpauth_url}
                            size={224}
                            level="M"
                            marginSize={4}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            role="img"
                            title="QR code pour configurer la double authentification"
                          />
                        </div>
                        <details className={styles.manual}>
                          <summary>Je ne peux pas scanner le QR code</summary>
                          <p>
                            Dans l’application, choisissez Saisir une clé de configuration. Nom du
                            compte : {user?.username}. Type de code : basé sur le temps (TOTP).
                          </p>
                          <code className="enrollmentSecret">{enrolment.secret_b32}</code>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void copyKey()}
                          >
                            Copier la clé
                          </Button>
                          {copyStatus && <p role="status">{copyStatus}</p>}
                        </details>
                      </li>
                      <li>
                        <strong>Confirmez avec le code affiché sur votre téléphone.</strong>
                        <p>
                          Le code change régulièrement. Saisissez celui qui est affiché maintenant.
                        </p>
                      </li>
                    </ol>
                    <Input
                      label="Code à six chiffres"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={token}
                      onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
                      required
                    />
                    <ActionError
                      error={verify.error}
                      title="Le code n’a pas été accepté."
                      showMfaAction={false}
                    />
                    <p>
                      Ce code confirme la configuration et vérifie votre connexion actuelle. Vous
                      pourrez ensuite travailler directement.
                    </p>
                    <div className={styles.actions}>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={verify.isPending || token.length !== 6}
                      >
                        {verify.isPending ? "Activation…" : "Activer et continuer"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={verify.isPending}
                        onClick={() => {
                          enrolmentGeneration.current += 1;
                          setEnrolment(null);
                          setToken("");
                          setCopyStatus("");
                          enable.reset();
                          verify.reset();
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="settingsForm">
                {recent ? (
                  <div role="status" className={styles.success}>
                    <strong>Votre identité est vérifiée.</strong>
                    <p>
                      Cette vérification reste valable pendant toute votre connexion. Aucun nouveau
                      code ne sera demandé pour chaque action.
                    </p>
                    <Link className={styles.returnLink} to={returnTo ?? "/"}>
                      {returnTo ? "Reprendre mon action" : "Retour à l’accueil"}
                    </Link>
                  </div>
                ) : (
                  <div className="settingsForm">
                    <p>
                      Votre connexion doit être vérifiée. Reconnectez-vous une fois avec le code de
                      votre application pour continuer.
                    </p>
                    <IdentityCheck />
                  </div>
                )}
                <ActionError
                  error={assurance.error}
                  title="La vérification de votre session est indisponible."
                  showMfaAction={false}
                />
                {required ? (
                  <p>
                    La double authentification est obligatoire pour votre compte et ne peut pas être
                    désactivée ici.
                  </p>
                ) : (
                  <details className={styles.disable}>
                    <summary>Désactiver la double authentification</summary>
                    <p>
                      Cette action termine vos sessions et retire les codes de connexion. Vous
                      pourrez vous reconnecter avec votre mot de passe.
                    </p>
                    {!recent && <p>Reconnectez-vous d’abord pour vérifier votre connexion.</p>}
                    <ActionError
                      error={disable.error}
                      title="La désactivation n’a pas abouti."
                      showMfaAction={false}
                    />
                    <Button
                      variant="dangerOutline"
                      disabled={!recent || disable.isPending}
                      onClick={() => disable.mutate()}
                    >
                      {disable.isPending ? "Désactivation…" : "Désactiver et terminer mes sessions"}
                    </Button>
                  </details>
                )}
              </div>
            )}
          </section>
          <div className="settingsGrid">
            <Card title="Votre profil">
              <dl className="profileDetails">
                <dt>Nom d’utilisateur</dt>
                <dd>{user?.username}</dd>
                <dt>Accès</dt>
                <dd>
                  {user?.is_superuser
                    ? "Superadministrateur"
                    : user?.role === "validateur"
                      ? "Validateur"
                      : "Éditeur"}
                </dd>
                <dt>Double authentification</dt>
                <dd>
                  {user?.has_2fa
                    ? "Activée"
                    : required
                      ? "Obligatoire, à configurer"
                      : "Facultative"}
                </dd>
              </dl>
            </Card>
            <Card title="Changer mon mot de passe">
              <form
                className="settingsForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  password.mutate();
                }}
              >
                <Input
                  label="Mot de passe actuel"
                  type="password"
                  autoComplete="current-password"
                  maxLength={256}
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  required
                />
                <Input
                  label="Nouveau mot de passe"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={256}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  help="12 caractères minimum. Ce changement termine toutes vos sessions."
                />
                <ActionError error={password.error} title="Le mot de passe n’a pas été modifié." />
                <Button variant="primary" type="submit" disabled={password.isPending}>
                  {password.isPending ? "Modification…" : "Modifier et me reconnecter"}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

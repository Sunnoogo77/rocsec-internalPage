import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input } from "@/components/ui";
import { accountsApi } from "@/api";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

export function ReglagesPage() {
  const { user, refresh } = useAuth();
  const cache = useQueryClient();
  const [enrolment, setEnrolment] = useState<{ secret_b32: string; otpauth_url: string } | null>(
    null,
  );
  const [token, setToken] = useState("");
  const [stepToken, setStepToken] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const assurance = useQuery({
    queryKey: ["mfa-assurance"],
    queryFn: () => api.get<{ is_recent: boolean; seconds_remaining: number }>("/auth/2fa/step-up/"),
    refetchInterval: 30000,
  });
  const enable = useMutation({ mutationFn: accountsApi.enable2fa, onSuccess: setEnrolment });
  const verify = useMutation({
    mutationFn: () => accountsApi.verify2fa(token),
    onSuccess: () => {
      setEnrolment(null);
      setToken("");
      void refresh();
    },
  });
  const disable = useMutation({
    mutationFn: accountsApi.disable2fa,
    onSuccess: () => {
      void refresh();
    },
  });
  const stepUp = useMutation({
    mutationFn: () => api.post("/auth/2fa/step-up/", { token: stepToken }),
    onSuccess: () => {
      setStepToken("");
      void cache.invalidateQueries({ queryKey: ["mfa-assurance"] });
    },
  });
  const password = useMutation({
    mutationFn: () =>
      api.post("/auth/password/", { current_password: oldPassword, new_password: newPassword }),
    onSuccess: () => {
      setOldPassword("");
      setNewPassword("");
      void refresh();
    },
  });
  const error = enable.error || verify.error || disable.error || stepUp.error || password.error;
  return (
    <>
      <Breadcrumb items={[{ label: "Réglages" }]} />
      <PageHead title="Mon compte" lede="Vos accès et la sécurité de votre espace de travail." />
      <PageBody>
        {error && (
          <p role="alert" className="errorNotice">
            {error.message}
          </p>
        )}
        <div className="settingsGrid">
          <Card title="Votre profil">
            <dl className="profileDetails">
              <dt>Adresse email</dt>
              <dd>{user?.email}</dd>
              <dt>Accès</dt>
              <dd>
                {user?.is_superuser
                  ? "Superadministrateur"
                  : user?.role === "validateur"
                    ? "Validateur"
                    : "Éditeur"}
              </dd>
              <dt>Double authentification</dt>
              <dd>{user?.has_2fa ? "Activée" : "À configurer"}</dd>
            </dl>
            <p className="securityNotice">
              La publication et la gestion des accès nécessitent une vérification de votre identité.
            </p>
          </Card>
          <Card title="Vérifier mon identité">
            {!user?.has_2fa ? (
              <p>Activez d’abord la double authentification ci-dessous.</p>
            ) : (
              <form
                className="settingsForm"
                onSubmit={(e) => {
                  e.preventDefault();
                  stepUp.mutate();
                }}
              >
                <p>
                  {assurance.data?.is_recent
                    ? "Identité vérifiée. Vous pouvez effectuer les actions sensibles pendant quelques minutes."
                    : "Saisissez un nouveau code de votre application d’authentification."}
                </p>
                <Input
                  label="Code de vérification"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={stepToken}
                  onChange={(e) => setStepToken(e.target.value)}
                  required
                  help="Un code déjà utilisé pour vous connecter ne peut pas être réutilisé. Attendez le code suivant."
                />
                <Button variant="primary" type="submit" disabled={stepUp.isPending}>
                  Vérifier mon identité
                </Button>
              </form>
            )}
          </Card>
          <Card title="Double authentification">
            {user?.has_2fa ? (
              <div className="settingsForm">
                <p>Votre connexion est protégée par un code temporaire.</p>
                <Button
                  variant="dangerOutline"
                  disabled={!assurance.data?.is_recent || disable.isPending}
                  onClick={() => disable.mutate()}
                >
                  Désactiver et terminer mes sessions
                </Button>
              </div>
            ) : enrolment ? (
              <form
                className="settingsForm"
                onSubmit={(e) => {
                  e.preventDefault();
                  verify.mutate();
                }}
              >
                <p>
                  Ajoutez cette clé à votre application d’authentification, puis saisissez le code
                  qu’elle affiche.
                </p>
                <code className="enrollmentSecret">{enrolment.secret_b32}</code>
                <Input
                  label="Premier code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
                <Button type="submit" variant="primary" disabled={verify.isPending}>
                  Activer et me reconnecter
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEnrolment(null);
                    setToken("");
                  }}
                >
                  Annuler
                </Button>
              </form>
            ) : (
              <div className="settingsForm">
                <p>
                  Protégez votre compte avec une application d’authentification sur votre téléphone.
                </p>
                <Button
                  variant="primary"
                  disabled={enable.isPending}
                  onClick={() => enable.mutate()}
                >
                  Configurer la double authentification
                </Button>
              </div>
            )}
          </Card>
          <Card title="Changer mon mot de passe">
            <form
              className="settingsForm"
              onSubmit={(e) => {
                e.preventDefault();
                password.mutate();
              }}
            >
              <Input
                label="Mot de passe actuel"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
              <Input
                label="Nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                help="12 caractères minimum. Ce changement termine toutes vos sessions."
              />
              <Button variant="primary" type="submit" disabled={password.isPending}>
                Modifier et me reconnecter
              </Button>
            </form>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

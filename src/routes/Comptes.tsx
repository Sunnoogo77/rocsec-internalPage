import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff } from "lucide-react";
import { api, HttpError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input, Modal, Select } from "@/components/ui";
import { ActionError } from "@/components/ui/ActionError";
import styles from "./Comptes.module.css";

interface ManagedAccount {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "editeur" | "validateur";
  is_active: boolean;
  must_change_password: boolean;
}

interface AccountReceipt {
  username: string;
  password: string;
}

function AccountReceiptDialog({
  receipt,
  onClose,
}: {
  receipt: AccountReceipt;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const loginUrl = `${window.location.origin}/login`;
  const message = [
    "Bonjour, votre accès à l’espace de gestion Roc Séculaire Tabernacle est prêt.",
    "",
    `Site : ${loginUrl}`,
    `Nom d’utilisateur : ${receipt.username}`,
    `Mot de passe provisoire : ${receipt.password}`,
    "",
    "À votre première connexion, le site vous demandera de choisir un nouveau mot de passe personnel.",
  ].join("\n");

  const copy = async (value: string, label: string) => {
    setCopied("");
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Compte créé"
      footer={<Button onClick={onClose}>Terminer</Button>}
    >
      <div className={styles.receipt}>
        <p role="status">
          Le compte est créé. Vous pouvez transmettre ces identifiants à la personne.
        </p>
        <p>Elle devra choisir son propre mot de passe à sa première connexion.</p>
        <div className={styles.receiptField}>
          <Input
            label="Nom d’utilisateur à transmettre"
            value={receipt.username}
            readOnly
            autoComplete="off"
          />
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Copy size={15} />}
            onClick={() => void copy(receipt.username, "Nom d’utilisateur copié.")}
          >
            Copier l’identifiant
          </Button>
        </div>
        <div className={styles.receiptField}>
          <Input
            label="Mot de passe provisoire à transmettre"
            type={visible ? "text" : "password"}
            value={receipt.password}
            readOnly
            autoComplete="off"
          />
          <div className={styles.actions}>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={visible}
              leftIcon={visible ? <EyeOff size={15} /> : <Eye size={15} />}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Copy size={15} />}
              onClick={() => void copy(receipt.password, "Mot de passe copié.")}
            >
              Copier le mot de passe
            </Button>
          </div>
        </div>
        <p>
          Site de connexion : <a href={loginUrl}>{loginUrl}</a>
        </p>
        <Button
          variant="primary"
          leftIcon={<Copy size={16} />}
          onClick={() => void copy(message, "Message complet copié.")}
        >
          Copier le message complet
        </Button>
        {copied && (
          <p role="status" className={styles.copyStatus}>
            {copied}
          </p>
        )}
        {copyError && (
          <p role="alert">
            La copie automatique n’est pas disponible. Sélectionnez les identifiants ci-dessus pour
            les copier manuellement.
          </p>
        )}
        <p className={styles.receiptHint}>
          Copiez les identifiants avant de fermer. Ce récapitulatif s’efface à la fermeture, en
          quittant cette page ou après cinq minutes.
        </p>
      </div>
    </Modal>
  );
}

export function ComptesPage() {
  const { user } = useAuth();
  const access = useWorkflowAccess();
  const cache = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"editeur" | "validateur">("editeur");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [receipt, setReceipt] = useState<AccountReceipt | null>(null);
  const pendingCreate = useRef<AbortController | null>(null);
  const accounts = useQuery({
    queryKey: ["accounts"],
    enabled: Boolean(user?.is_superuser),
    queryFn: () => api.get<{ results: ManagedAccount[] }>("/auth/users/"),
  });

  useEffect(() => {
    if (access.recent && user?.is_superuser) {
      void cache.invalidateQueries({ queryKey: ["accounts"] });
    }
  }, [access.recent, cache, user?.is_superuser]);

  useEffect(() => {
    const clearPrivateDraft = () => {
      pendingCreate.current?.abort();
      setPassword("");
      setReceipt(null);
      setCreating(false);
    };
    window.addEventListener("pagehide", clearPrivateDraft);
    return () => {
      pendingCreate.current?.abort();
      window.removeEventListener("pagehide", clearPrivateDraft);
    };
  }, []);
  useEffect(() => {
    if (!receipt) return;
    const timeout = window.setTimeout(() => setReceipt(null), 5 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [receipt]);

  // Keep temporary credentials out of the shared query/mutation cache.
  // They live only in this page until the receipt is dismissed or the page unmounts.
  const createAccount = async () => {
    if (pendingCreate.current || !user?.is_superuser) return;
    const controller = new AbortController();
    pendingCreate.current = controller;
    setCreating(true);
    setCreateError(null);
    setReceipt(null);
    const submittedPassword = password;
    try {
      const created = await api.post<ManagedAccount>(
        "/auth/users/",
        { username, password: submittedPassword, role },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setReceipt({ username: created.username, password: submittedPassword });
      setUsername("");
      setPassword("");
      void cache.invalidateQueries({ queryKey: ["accounts"] });
    } catch (error) {
      if (!controller.signal.aborted) {
        setCreateError(error);
        if (!(error instanceof HttpError) || error.status >= 500) {
          // The server may have committed the account before the response was lost.
          // Refresh the list without resending a request that could create a duplicate.
          void cache.invalidateQueries({ queryKey: ["accounts"] });
        }
      }
    } finally {
      if (!controller.signal.aborted) setCreating(false);
      pendingCreate.current = null;
    }
  };

  const update = useMutation({
    mutationFn: (account: ManagedAccount) =>
      api.patch(`/auth/users/${account.id}/`, { is_active: !account.is_active }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const creationUncertain =
    createError && (!(createError instanceof HttpError) || createError.status >= 500);
  if (!user?.is_superuser)
    return (
      <PageBody>
        <p>La gestion des comptes est réservée au superadministrateur.</p>
      </PageBody>
    );

  return (
    <>
      <Breadcrumb items={[{ label: "Équipe et accès" }]} />
      <PageHead
        title="Équipe et accès"
        lede="Attribuez à chacun les accès nécessaires à son service."
      />
      <PageBody>
        {!access.recent && <IdentityCheck />}
        <div className="settingsGrid">
          <Card title="Comptes de l’équipe">
            <ActionError error={accounts.error} title="Impossible de charger les comptes" />
            <ActionError error={update.error} title="Le compte n’a pas été modifié" />
            {accounts.isLoading ? (
              <p>Chargement des comptes…</p>
            ) : accounts.isSuccess && !accounts.data.results.length ? (
              <p>Aucun compte dans l’équipe pour le moment.</p>
            ) : (
              <div className="accountList">
                {accounts.data?.results.map((account) => (
                  <div key={account.id} className="accountRow">
                    <div>
                      <strong>{account.username}</strong>
                      <p>
                        {account.role === "validateur" ? "Validateur" : "Éditeur"} ·{" "}
                        {account.is_active ? "Actif" : "Désactivé"}
                        {account.must_change_password ? " · Mot de passe à renouveler" : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      disabled={account.id === user.id || update.isPending}
                      onClick={() => update.mutate(account)}
                    >
                      {update.isPending && update.variables?.id === account.id
                        ? "Enregistrement…"
                        : account.is_active
                          ? "Désactiver"
                          : "Réactiver"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Ajouter une personne habilitée">
            <form
              className="settingsForm"
              aria-busy={creating}
              onSubmit={(event) => {
                event.preventDefault();
                void createAccount();
              }}
            >
              <Input
                label="Nom d’utilisateur"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={150}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={creating}
              />
              <Select
                label="Rôle"
                value={role}
                onChange={(e) => setRole(e.target.value as "editeur" | "validateur")}
                disabled={creating}
              >
                <option value="editeur">Éditeur — préparer les contenus</option>
                <option value="validateur">Validateur — relire et publier</option>
              </Select>
              <Input
                label="Mot de passe initial"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                maxLength={256}
                required
                autoComplete="new-password"
                disabled={creating}
                help="Au moins 12 caractères. La personne devra le remplacer à sa première connexion."
              />
              <ActionError
                error={createError}
                title={
                  creationUncertain
                    ? "Impossible de confirmer la création du compte"
                    : "Le compte n’a pas été créé"
                }
                fallback="Vérifiez la liste des comptes avant de réessayer."
              />
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? "Création…" : "Créer le compte"}
              </Button>
            </form>
          </Card>
        </div>
      </PageBody>
      {receipt && <AccountReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

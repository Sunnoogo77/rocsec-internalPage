import { useEffect, useRef, useState } from "react";
import { api, HttpError } from "@/api/client";
import { Button, Input, Modal, Select, Toggle } from "@/components/ui";
import { ActionError } from "@/components/ui/ActionError";
import type { ManagedAccount } from "./Comptes";

export function AccountEditor({
  account,
  onClose,
  onSaved,
  onUncertain,
}: {
  account: ManagedAccount;
  onClose: () => void;
  onSaved: (account: ManagedAccount, password: string) => void;
  onUncertain: () => void;
}) {
  const [role, setRole] = useState(account.role);
  const [active, setActive] = useState(account.is_active);
  const [mfaRequired, setMfaRequired] = useState(account.mfa_required);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const clear = () => {
      request.current?.abort();
      setPassword("");
      setPending(false);
    };
    window.addEventListener("pagehide", clear);
    return () => {
      request.current?.abort();
      window.removeEventListener("pagehide", clear);
    };
  }, []);
  const save = async () => {
    if (request.current || account.is_superuser) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const updated = await api.patch<ManagedAccount>(
        `/auth/users/${account.id}/`,
        {
          role,
          is_active: active,
          mfa_required: mfaRequired,
          ...(password ? { password } : {}),
        },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) onSaved(updated, password);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure);
        if (!(failure instanceof HttpError) || failure.status >= 500) onUncertain();
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
      request.current = null;
    }
  };
  const uncertain = error && (!(error instanceof HttpError) || error.status >= 500);
  return (
    <Modal
      open
      title={`Modifier l’accès de ${account.username}`}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="settingsForm"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p>Les changements d’accès ou de mot de passe terminent les sessions de cette personne.</p>
        <Select
          label="Niveau d’accès"
          value={role}
          onChange={(event) => setRole(event.target.value as ManagedAccount["role"])}
          disabled={pending}
        >
          <option value="editeur">Éditeur — créer et modifier les contenus</option>
          <option value="validateur">Validateur — créer, modifier et publier</option>
        </Select>
        <Toggle label="Compte actif" checked={active} onChange={setActive} disabled={pending} />
        <Toggle
          label="Exiger la double authentification"
          checked={Boolean(mfaRequired)}
          onChange={setMfaRequired}
          disabled={pending}
        />
        <p>
          Si cette option est activée, la personne configurera son application à sa prochaine
          connexion. Le code ne sera demandé qu’une fois par connexion.
        </p>
        <Input
          label="Nouveau mot de passe provisoire (facultatif)"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
          help="Laissez vide pour conserver son mot de passe. Sinon, elle devra le remplacer à sa prochaine connexion."
        />
        <ActionError
          error={error}
          title={
            uncertain
              ? "Impossible de confirmer la modification du compte"
              : "La modification a été refusée"
          }
          fallback="Vérifiez les informations du compte avant de réessayer."
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les accès"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
          Annuler
        </Button>
      </form>
    </Modal>
  );
}

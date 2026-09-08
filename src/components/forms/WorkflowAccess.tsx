import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/api/client";
import { Button, Input, Modal } from "@/components/ui";

export function useWorkflowAccess(
  item?: { cree_par: string | null; modifie_par: string | null } | null,
) {
  const { user } = useAuth();
  const validator = Boolean(user?.is_superuser || user?.role === "validateur");
  const own = Boolean(user && item && [item.cree_par, item.modifie_par].includes(user.id));
  const assurance = useQuery({
    queryKey: ["mfa-assurance"],
    queryFn: () => api.get<{ is_recent: boolean; seconds_remaining: number }>("/auth/2fa/step-up/"),
    enabled: validator,
    refetchInterval: 15_000,
    staleTime: 0,
  });
  const recent =
    assurance.isSuccess &&
    assurance.data.is_recent &&
    Date.now() < assurance.dataUpdatedAt + assurance.data.seconds_remaining * 1000;
  return {
    validator,
    own,
    recent,
    canValidate: validator && !own && recent,
    canManage: validator && recent,
    assurance,
  };
}
export function IdentityCheck() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const cache = useQueryClient();
  const verify = useMutation({
    mutationFn: () => api.post("/auth/2fa/step-up/", { token }),
    onSuccess: () => {
      setToken("");
      setOpen(false);
      void cache.invalidateQueries({ queryKey: ["mfa-assurance"] });
    },
  });
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          verify.reset();
          setOpen(true);
        }}
      >
        Vérifier mon identité
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!verify.isPending) {
            setOpen(false);
            setToken("");
          }
        }}
        title="Confirmer votre identité"
      >
        <form
          className="settingsForm"
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate();
          }}
        >
          <p>
            Entrez le code à six chiffres de votre application d’authentification. Votre fiche reste
            ouverte.
          </p>
          <Input
            label="Code d’authentification"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
          />
          {verify.error && <p role="alert">{verify.error.message}</p>}
          <Button type="submit" disabled={verify.isPending || token.length !== 6}>
            {verify.isPending ? "Vérification…" : "Confirmer"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { revisionOptions, type PublicationState } from "@/lib/publication";
import { Button, Modal } from "@/components/ui";
import { ActionError } from "@/components/ui/ActionError";

export function DiscardRevision({
  item,
  endpoint,
  listPath,
  busy,
  version,
}: {
  item?: PublicationState | null;
  endpoint: string;
  listPath: string;
  busy?: boolean;
  version: number;
}) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const discard = useMutation({
    mutationFn: () =>
      api.post(
        `${endpoint}annuler-revision/`,
        undefined,
        revisionOptions({ statut: "", revision_version: version }),
      ),
    onSuccess: () => {
      void cache.invalidateQueries();
      setOpen(false);
      navigate(listPath);
    },
  });
  if (!item?.revision?.can_discard) return null;
  return (
    <>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => {
          discard.reset();
          setOpen(true);
        }}
      >
        Abandonner la correction
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!discard.isPending) setOpen(false);
        }}
        title="Abandonner cette correction ?"
        footer={
          <>
            <Button variant="ghost" disabled={discard.isPending} onClick={() => setOpen(false)}>
              Garder la correction
            </Button>
            <Button
              variant="dangerOutline"
              disabled={discard.isPending}
              onClick={() => discard.mutate()}
            >
              {discard.isPending ? "Abandon…" : "Abandonner et revenir à la liste"}
            </Button>
          </>
        }
      >
        <p>
          La correction enregistrée et vos changements non enregistrés seront abandonnés. La version
          actuellement en ligne restera inchangée.
        </p>
        <ActionError error={discard.error} title="La correction n’a pas été abandonnée." />
      </Modal>
    </>
  );
}

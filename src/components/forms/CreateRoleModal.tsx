/**
 * Modale de création inline d'un `RolePersonne` (ex. « Diacre principal »).
 * Le `code` est généré automatiquement depuis le libellé FR si laissé vide.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button, Input, Modal } from "@/components/ui";
import { rolesPersonneApi } from "@/api";
import { ActionError } from "@/components/ui/ActionError";
import type { RolePersonne } from "@/types";

export interface CreateRoleModalProps {
  onClose: () => void;
  onCreated: (r: RolePersonne) => void;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateRoleModal({ onClose, onCreated }: CreateRoleModalProps) {
  const [libelleFr, setLibelleFr] = useState("");
  const [libelleEn, setLibelleEn] = useState("");
  const [codeOverride, setCodeOverride] = useState("");

  const code = (codeOverride || slugify(libelleFr)).trim();

  const mutation = useMutation({
    mutationFn: () =>
      rolesPersonneApi.create({
        code,
        libelle_fr: libelleFr.trim(),
        libelle_en: libelleEn.trim(),
        actif: true,
        ordre: 200, // placé après les défauts (10..100)
      }),
    onSuccess: (r) => onCreated(r),
  });

  const canSubmit = libelleFr.trim().length > 0 && code.length > 0 && !mutation.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau rôle"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? "Création…" : "Créer le rôle"}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <Input
          label="Libellé (français)"
          required
          value={libelleFr}
          onChange={(event) => setLibelleFr(event.target.value)}
          placeholder='ex. "Diacre principal", "Chef de chœur"'
        />
        <Input
          label="Libellé (anglais)"
          value={libelleEn}
          onChange={(event) => setLibelleEn(event.target.value)}
          help="Optionnel — utilisé pour la version anglaise de la vitrine."
        />
        <Input
          label="Code (identifiant technique)"
          value={code}
          onChange={(event) => setCodeOverride(event.target.value)}
          help="Généré automatiquement depuis le libellé. Modifiable si besoin (doit rester court et sans accent)."
        />
        <ActionError error={mutation.error} title="Le rôle n’a pas été créé." />
      </div>
    </Modal>
  );
}

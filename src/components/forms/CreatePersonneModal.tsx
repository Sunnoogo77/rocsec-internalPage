import { IdentityCheck, useWorkflowAccess } from "./WorkflowAccess";
import common from "@/routes/common.module.css";
/**
 * Modale de création inline d'une `Personne` depuis le PersonneMultiSelect.
 *
 * Permet d'ajouter rapidement un nouvel interprète sans quitter le formulaire
 * de cantique. Le formulaire propose la sélection de plusieurs rôles (M2M) et
 * la possibilité de créer un rôle qui n'existe pas encore. La fiche complète
 * (photo, bio) peut être enrichie plus tard depuis l'écran Personnes.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Button, Input, Modal, Select } from "@/components/ui";
import { personnesApi } from "@/api";
import { HttpError } from "@/api/client";
import type { Personne } from "@/types";

import { RolesMultiSelect } from "./RolesMultiSelect";

const CIVILITES: { value: string; label: string }[] = [
  { value: "Fr.", label: "Frère (Fr.)" },
  { value: "Sœur", label: "Sœur" },
  { value: "Past.", label: "Pasteur (abrégé)" },
  { value: "Pasteur", label: "Pasteur" },
  { value: "Rév.", label: "Révérend" },
  { value: "autre", label: "Autre" },
];

export interface CreatePersonneModalProps {
  initialName?: string;
  onClose: () => void;
  onCreated: (p: Personne) => void;
}

export function CreatePersonneModal({
  initialName = "",
  onClose,
  onCreated,
}: CreatePersonneModalProps) {
  const access = useWorkflowAccess();
  // On essaie de découper "Prénom Nom" depuis la recherche en cours.
  const parts = initialName.trim().split(/\s+/);
  const [civilite, setCivilite] = useState("Fr.");
  const [prenom, setPrenom] = useState(parts[0] ?? "");
  const [nom, setNom] = useState(parts.slice(1).join(" "));
  const [roles, setRoles] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () =>
      personnesApi.create({
        civilite,
        prenom: prenom.trim(),
        nom: nom.trim(),
        roles,
      }),
    onSuccess: (p) => onCreated(p),
  });

  const serverError = mutation.error instanceof HttpError ? mutation.error : null;

  const canSubmit =
    prenom.trim().length > 0 && nom.trim().length > 0 && !mutation.isPending && access.canManage;

  return (
    <Modal
      open
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Ajouter une personne"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? "Création…" : "Créer la personne"}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        {!access.recent && <IdentityCheck />}
        <div className={common.formGrid}>
          <Select
            label="Civilité"
            value={civilite}
            onChange={(event) => setCivilite(event.target.value)}
          >
            {CIVILITES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input
            label="Prénom"
            required
            value={prenom}
            onChange={(event) => setPrenom(event.target.value)}
          />
          <Input
            label="Nom"
            required
            value={nom}
            onChange={(event) => setNom(event.target.value)}
          />
        </div>
        <RolesMultiSelect
          value={roles}
          onChange={setRoles}
          help="Sélectionne tous les rôles applicables (pasteur, chantre, choeur…). Bouton « + Nouveau rôle » pour en créer un."
        />
        {serverError ? (
          <p style={{ color: "var(--red-700)", fontSize: 13, margin: 0 }}>{serverError.message}</p>
        ) : null}
      </div>
    </Modal>
  );
}

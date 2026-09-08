/**
 * Multi-sélecteur de rôles pour une `Personne`. Tous les rôles actifs sont
 * affichés en chips toggleables (cliquer = activer/désactiver). Un bouton
 * « + Nouveau rôle » ouvre une modale pour en créer un.
 *
 * Préféré à un combobox autocomplété car la liste de rôles est volontairement
 * courte (~10 entrées) et tous doivent être visibles en un coup d'œil.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { rolesPersonneApi } from "@/api";
import type { RolePersonne } from "@/types";

import { CreateRoleModal } from "./CreateRoleModal";
import styles from "./RolesMultiSelect.module.css";

export interface RolesMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  help?: string;
}

export function RolesMultiSelect({
  value,
  onChange,
  label = "Rôles",
  help,
}: RolesMultiSelectProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ["roles-personne"],
    queryFn: () => rolesPersonneApi.list(),
    staleTime: 5 * 60_000,
  });

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  const handleCreated = (r: RolePersonne) => {
    onChange([...value, r.id]);
    setCreating(false);
    void queryClient.invalidateQueries({ queryKey: ["roles-personne"] });
  };

  return (
    <div className={styles.wrapper}>
      {label ? <span className={styles.label}>{label}</span> : null}
      {rolesQuery.isError && (
        <p role="alert">
          Impossible de charger les rôles.{" "}
          <button type="button" onClick={() => void rolesQuery.refetch()}>
            Réessayer
          </button>
        </p>
      )}
      <div className={styles.chips}>
        {rolesQuery.isLoading ? (
          <span className={styles.help}>Chargement…</span>
        ) : (
          (rolesQuery.data ?? []).map((r) => {
            const active = value.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                onClick={() => toggle(r.id)}
              >
                {r.libelle_fr}
              </button>
            );
          })
        )}
        <button type="button" className={styles.add} onClick={() => setCreating(true)}>
          + Nouveau rôle
        </button>
      </div>
      {help ? <span className={styles.help}>{help}</span> : null}

      {creating ? (
        <CreateRoleModal onClose={() => setCreating(false)} onCreated={handleCreated} />
      ) : null}
    </div>
  );
}

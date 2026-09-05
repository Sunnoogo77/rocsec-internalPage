/**
 * Multi-sélecteur autocomplété pour la M2M `interpretes` (Personne).
 *
 * - Recherche débouncée sur /api/v1/personnes/?search=<q>.
 * - Affiche les personnes sélectionnées sous forme de chips.
 * - Si la recherche ne donne aucun résultat, propose d'ouvrir la modale de
 *   création d'une nouvelle personne (pré-remplie avec la recherche en cours).
 * - L'objectif est de garantir l'unicité (pas de duplication "Fr. Jules Kayembe"
 *   saisi à la main 3 fois sous 3 formes différentes).
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { personnesApi } from "@/api";
import type { Personne } from "@/types";

import { CreatePersonneModal } from "./CreatePersonneModal";
import styles from "./PersonneMultiSelect.module.css";

export interface PersonneMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  help?: string;
}

export function PersonneMultiSelect({
  value,
  onChange,
  label,
  placeholder = "Rechercher un nom…",
  help,
}: PersonneMultiSelectProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Suggestions : on requête /personnes/ avec ?search=.
  const searchQuery = useQuery({
    queryKey: ["personnes-search", debouncedQuery],
    queryFn: () => personnesApi.list({ q: debouncedQuery, page_size: 10 }),
    enabled: open && debouncedQuery.length > 0,
  });

  // Personnes déjà sélectionnées (pour afficher les chips même avant le 1er search).
  const selectedQuery = useQuery({
    queryKey: ["personnes-selected", value.slice().sort().join(",")],
    queryFn: async () => {
      if (value.length === 0) return [] as Personne[];
      const out = await Promise.all(
        value.map((id) => personnesApi.get(id).catch(() => null)),
      );
      return out.filter((p): p is Personne => p !== null);
    },
  });

  const suggestions = useMemo(() => {
    const list = searchQuery.data?.results ?? [];
    return list.filter((p) => !value.includes(p.id));
  }, [searchQuery.data, value]);

  const handleAdd = (p: Personne) => {
    if (value.includes(p.id)) return;
    onChange([...value, p.id]);
    setQuery("");
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((x) => x !== id));
  };

  const handleCreated = (p: Personne) => {
    onChange([...value, p.id]);
    setCreating(false);
    setQuery("");
    void queryClient.invalidateQueries({ queryKey: ["personnes-search"] });
  };

  return (
    <div className={styles.wrapper}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.chips}>
        {(selectedQuery.data ?? []).map((p) => (
          <span key={p.id} className={styles.chip}>
            {p.libelle}
            <button
              type="button"
              aria-label={`Retirer ${p.libelle}`}
              onClick={() => handleRemove(p.id)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          className={styles.input}
          placeholder={value.length === 0 ? placeholder : ""}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Laisser le temps au click de la liste de se déclencher avant de fermer.
            setTimeout(() => setOpen(false), 150);
          }}
        />
      </div>

      {open && debouncedQuery.length > 0 ? (
        <div className={styles.dropdown}>
          {searchQuery.isFetching ? (
            <div className={styles.dropdownEmpty}>Recherche…</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.dropdownItem}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleAdd(p)}
              >
                <strong>{p.libelle}</strong>
                <span className={styles.role}>{p.role_principal}</span>
              </button>
            ))
          ) : (
            <div className={styles.dropdownEmpty}>
              Aucune personne ne correspond à « {debouncedQuery} ».
            </div>
          )}
          <button
            type="button"
            className={styles.dropdownCreate}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setCreating(true);
              setOpen(false);
            }}
          >
            + Créer une personne{debouncedQuery ? ` « ${debouncedQuery} »` : ""}
          </button>
        </div>
      ) : null}

      {help ? <span className={styles.help}>{help}</span> : null}

      {creating ? (
        <CreatePersonneModal
          initialName={debouncedQuery}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}

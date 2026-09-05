/**
 * Sélecteur autocomplété pour UNE personne (cardinalité 1 ou 0).
 *
 * Variante de `PersonneMultiSelect` : même look (chip + dropdown), mais
 * une seule valeur à la fois + reset facile. Utilisé pour `interprete_lead`
 * sur un cantique (lead vocal).
 *
 * - Si une `restrictToIds` est fournie, on filtre les suggestions à ces UUIDs
 *   (cas du lead vocal : doit être l'un des interprètes déjà sélectionnés).
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { personnesApi } from "@/api";
import type { Personne } from "@/types";

import styles from "./PersonneMultiSelect.module.css";

export interface PersonneSinglePickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  help?: string;
  /** Si défini, ne propose que des Personnes dont l'UUID est dans cette liste. */
  restrictToIds?: string[];
  /** Si défini, montre une note quand la valeur courante n'est pas dans
   *  restrictToIds (ex. lead pas dans les interprètes sélectionnés). */
  invalidNote?: string;
}

export function PersonneSinglePicker({
  value,
  onChange,
  label,
  placeholder = "Rechercher un nom…",
  help,
  restrictToIds,
  invalidNote,
}: PersonneSinglePickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Suggestions : on requête /personnes/?search=.
  const searchQuery = useQuery({
    queryKey: ["personnes-search-single", debouncedQuery],
    queryFn: () => personnesApi.list({ q: debouncedQuery, page_size: 10 }),
    enabled: open && debouncedQuery.length > 0,
  });

  // Personne actuellement sélectionnée (pour la chip).
  const selectedQuery = useQuery({
    queryKey: ["personne-selected-single", value],
    queryFn: () => (value ? personnesApi.get(value).catch(() => null) : null),
    enabled: Boolean(value),
  });

  const suggestions = useMemo(() => {
    const list = searchQuery.data?.results ?? [];
    if (restrictToIds && restrictToIds.length > 0) {
      const set = new Set(restrictToIds);
      return list.filter((p) => set.has(p.id));
    }
    return list;
  }, [searchQuery.data, restrictToIds]);

  // Si pas de search actif mais que restrictToIds existe, on liste directement
  // les personnes autorisées (utile quand l'utilisateur ouvre le picker sans
  // taper — il voit les interprètes déjà sélectionnés comme choix possibles).
  const restrictedList = useQuery({
    queryKey: ["personnes-restricted", (restrictToIds ?? []).slice().sort().join(",")],
    queryFn: async () => {
      if (!restrictToIds || restrictToIds.length === 0) return [] as Personne[];
      const out = await Promise.all(
        restrictToIds.map((id) => personnesApi.get(id).catch(() => null)),
      );
      return out.filter((p): p is Personne => p !== null);
    },
    enabled: Boolean(restrictToIds && restrictToIds.length > 0 && open && !debouncedQuery),
  });

  const handleSelect = (p: Personne) => {
    onChange(p.id);
    setQuery("");
    setOpen(false);
  };
  const handleClear = () => {
    onChange("");
    setQuery("");
  };

  const selected = selectedQuery.data ?? null;
  const valueInRestrict =
    !restrictToIds || restrictToIds.length === 0 || (value && restrictToIds.includes(value));
  const showRestrictedList =
    open && !debouncedQuery && restrictToIds && restrictToIds.length > 0;

  return (
    <div className={styles.wrapper}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.chips}>
        {selected ? (
          <span className={styles.chip}>
            {selected.libelle}
            <button
              type="button"
              aria-label={`Retirer ${selected.libelle} (lead)`}
              onClick={handleClear}
            >
              ×
            </button>
          </span>
        ) : null}
        {!selected && (
          <input
            type="text"
            className={styles.input}
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        )}
      </div>

      {open && (debouncedQuery.length > 0 || showRestrictedList) ? (
        <div className={styles.dropdown}>
          {debouncedQuery.length > 0 ? (
            searchQuery.isFetching ? (
              <div className={styles.dropdownEmpty}>Recherche…</div>
            ) : suggestions.length > 0 ? (
              suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.dropdownItem}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(p)}
                >
                  <strong>{p.libelle}</strong>
                  <span className={styles.role}>{p.role_principal}</span>
                </button>
              ))
            ) : (
              <div className={styles.dropdownEmpty}>
                {restrictToIds && restrictToIds.length > 0
                  ? "Aucune personne sélectionnée comme interprète ne correspond à cette recherche."
                  : `Aucune personne ne correspond à « ${debouncedQuery} ».`}
              </div>
            )
          ) : showRestrictedList ? (
            (restrictedList.data ?? []).length > 0 ? (
              (restrictedList.data ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.dropdownItem}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(p)}
                >
                  <strong>{p.libelle}</strong>
                  <span className={styles.role}>{p.role_principal}</span>
                </button>
              ))
            ) : (
              <div className={styles.dropdownEmpty}>
                Sélectionne d'abord des interprètes ci-dessus.
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {!valueInRestrict && invalidNote ? (
        <span className={styles.help} style={{ color: "#b91c1c" }}>
          ⚠ {invalidNote}
        </span>
      ) : help ? (
        <span className={styles.help}>{help}</span>
      ) : null}
    </div>
  );
}

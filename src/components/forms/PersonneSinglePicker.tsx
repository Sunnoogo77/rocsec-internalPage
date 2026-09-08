import { useId, useRef, useState } from "react";
import { usePeople, normalizeSearch, personName, roleCodes, roleLabel } from "@/lib/people";
import styles from "./PersonneMultiSelect.module.css";

export interface PersonneSinglePickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  help?: string;
  restrictToIds?: string[];
  allowedRoles?: string[];
  invalidNote?: string;
}
export function PersonneSinglePicker({
  value,
  onChange,
  label = "Personne",
  placeholder = "Rechercher un nom…",
  help,
  restrictToIds,
  allowedRoles,
  invalidNote,
}: PersonneSinglePickerProps) {
  const directory = usePeople();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const eligible = (directory.data ?? []).filter(
    (p) =>
      p.actif &&
      (restrictToIds === undefined || restrictToIds.includes(p.id)) &&
      (!allowedRoles || roleCodes(p).some((r) => allowedRoles.includes(r))),
  );
  const suggestions = eligible.filter((p) =>
    normalizeSearch(`${personName(p)} ${p.prenom} ${p.nom}`).includes(normalizeSearch(search)),
  );
  const selected = directory.data?.find((p) => p.id === value);
  const invalid = value && directory.isSuccess && !eligible.some((p) => p.id === value);
  const select = (next: string) => {
    onChange(next);
    setSearch("");
    setOpen(false);
  };
  return (
    <div className={styles.wrapper}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {value ? (
        <div className={styles.chips}>
          <span>
            {selected
              ? personName(selected)
              : directory.isLoading
                ? "Chargement…"
                : "Personne sélectionnée indisponible"}
          </span>
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              onChange("");
              requestAnimationFrame(() => input.current?.focus());
            }}
            aria-label={`Retirer ${selected ? personName(selected) : "la sélection"}`}
          >
            Retirer
          </button>
        </div>
      ) : (
        <div className={styles.chips}>
          <input
            id={id}
            ref={input}
            className={styles.input}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-describedby={`${id}-help`}
            aria-activedescendant={open && suggestions[active] ? `${id}-${active}` : undefined}
            autoComplete="off"
            placeholder={placeholder}
            value={search}
            onFocus={() => {
              setOpen(true);
              setActive(0);
            }}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setSearch(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setOpen(true);
                const next = Math.max(
                  0,
                  Math.min(suggestions.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)),
                );
                setActive(next);
                document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" });
              }
              if (e.key === "Enter" && open) {
                e.preventDefault();
                if (suggestions[active]) select(suggestions[active].id);
              }
            }}
          />
        </div>
      )}
      {open && !value && (
        <div className={styles.dropdown}>
          {directory.isLoading ? (
            <p className={styles.dropdownEmpty}>Chargement du répertoire…</p>
          ) : directory.isError ? (
            <p className={styles.dropdownEmpty}>Répertoire indisponible.</p>
          ) : (
            <>
              <ul role="listbox" id={`${id}-list`} aria-label={label}>
                {suggestions.map((p, index) => (
                  <li
                    role="option"
                    aria-selected={active === index}
                    id={`${id}-${index}`}
                    key={p.id}
                    className={styles.dropdownItem}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(p.id)}
                  >
                    <strong>{personName(p)}</strong>
                    <span className={styles.role}>{roleLabel(p)}</span>
                  </li>
                ))}
              </ul>
              {!suggestions.length && (
                <p className={styles.dropdownEmpty}>
                  {restrictToIds?.length === 0
                    ? "Sélectionnez d’abord les interprètes du cantique."
                    : "Aucune personne active ne correspond. Vérifiez les rôles dans le répertoire Personnes."}
                </p>
              )}
            </>
          )}
        </div>
      )}
      <span id={`${id}-help`} className={styles.help}>
        {invalid ? (
          <span role="alert" style={{ color: "var(--red-700)" }}>
            {invalidNote ||
              "Cette personne ne remplit plus les critères de sélection. Choisissez une autre fiche ou corrigez ses rôles."}
          </span>
        ) : (
          help
        )}
      </span>
      {directory.isError && (
        <button type="button" className={styles.clear} onClick={() => void directory.refetch()}>
          Réessayer le chargement du répertoire
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { usePeople, personName } from "@/lib/people";
import { PersonneSinglePicker } from "./PersonneSinglePicker";
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
  placeholder,
  help,
}: PersonneMultiSelectProps) {
  const directory = usePeople();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  return (
    <div className={styles.wrapper}>
      {value.length > 0 && (
        <div className={styles.chips}>
          {value.map((id) => {
            const person = directory.data?.find((p) => p.id === id);
            const name = person
              ? personName(person)
              : directory.isLoading
                ? "Chargement…"
                : "Fiche indisponible";
            return (
              <span key={id} className={styles.chip}>
                {name}
                {person && !person.actif ? " · inactive" : ""}
                <button
                  type="button"
                  aria-label={`Retirer ${name}`}
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <PersonneSinglePicker
        value=""
        onChange={(id) => {
          if (id && !value.includes(id)) onChange([...value, id]);
        }}
        label={label}
        placeholder={placeholder}
        help={help}
        restrictToIds={directory.data?.filter((p) => !value.includes(p.id)).map((p) => p.id)}
      />
      {(user?.is_superuser || user?.role === "validateur") && (
        <button type="button" className={styles.clear} onClick={() => setCreating(true)}>
          Ajouter une fiche au répertoire
        </button>
      )}
      {creating && (
        <CreatePersonneModal
          initialName=""
          onClose={() => setCreating(false)}
          onCreated={(person) => {
            void queryClient.invalidateQueries({ queryKey: ["personnes-directory"] });
            onChange([...value, person.id]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

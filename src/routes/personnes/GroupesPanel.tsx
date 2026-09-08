import { Modal } from "@/components/ui/Modal";
/**
 * Modal admin : gestion des groupes de personnes (ex. « Chœurs »).
 *
 * Ouverte depuis la page Personnes via « Gérer les groupes ». L'admin crée des
 * groupes éventuellement vides, puis y ajoute des membres au fil du temps. Une
 * Personne peut appartenir à plusieurs groupes simultanément (M2M).
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Card, Input, Textarea, Toggle } from "@/components/ui";
import { HttpError } from "@/api/client";
import { groupesPersonnesApi, personnesApi } from "@/api";
import type { GroupePersonnes, Personne } from "@/types";

interface DraftGroupe {
  nom_fr: string;
  nom_en: string;
  description_fr: string;
  description_en: string;
  membres: string[];
  actif: boolean;
}

function emptyDraft(): DraftGroupe {
  return {
    nom_fr: "",
    nom_en: "",
    description_fr: "",
    description_en: "",
    membres: [],
    actif: true,
  };
}

export function GroupesPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal open wide onClose={onClose} title="Groupes de personnes">
      <p style={{ marginBottom: 20, color: "var(--gray-600)" }}>
        Regroupez les personnes qui chantent ou servent ensemble. Les groupes peuvent ensuite être
        sélectionnés dans un cantique.
      </p>
      <GroupesContent />
    </Modal>
  );
}

function GroupesContent() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["groupes-personnes"],
    queryFn: () => groupesPersonnesApi.list(),
  });
  const personnesQuery = useQuery({
    queryKey: ["personnes-for-groupe-picker"],
    queryFn: () => personnesApi.list({ page_size: 200 }),
  });

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftGroupe>(emptyDraft());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["groupes-personnes"] });

  const createMutation = useMutation({
    mutationFn: () => groupesPersonnesApi.create(draft),
    onSuccess: () => {
      setDraft(emptyDraft());
      setCreating(false);
      invalidate();
    },
  });

  const createError = createMutation.error instanceof HttpError ? createMutation.error : null;
  const personnes = personnesQuery.data?.results ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {!creating ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={() => setCreating(true)}>+ Nouveau groupe</Button>
        </div>
      ) : (
        <Card title="Nouveau groupe">
          {createError && (
            <div
              role="alert"
              style={{
                background: "rgba(220, 38, 38, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                color: "var(--red-700)",
                borderRadius: 6,
                padding: "10px 14px",
                margin: "0 0 14px",
                fontSize: 13,
              }}
            >
              <strong>Création refusée :</strong> {createError.message}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <Input
              label="Nom FR"
              required
              value={draft.nom_fr}
              onChange={(e) => setDraft((p) => ({ ...p, nom_fr: e.target.value }))}
              placeholder="ex. Chœurs"
            />
            <Input
              label="Nom EN"
              value={draft.nom_en}
              onChange={(e) => setDraft((p) => ({ ...p, nom_en: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Textarea
              label="Description FR"
              rows={2}
              value={draft.description_fr}
              onChange={(e) => setDraft((p) => ({ ...p, description_fr: e.target.value }))}
            />
          </div>
          <p style={{ fontSize: 13, color: "var(--gray-600)", margin: "0 0 8px" }}>
            Membres (optionnel — on peut créer le groupe vide et l'enrichir après) :
          </p>
          <PersonnesMultiPicker
            personnes={personnes}
            selected={new Set(draft.membres)}
            onToggle={(id) =>
              setDraft((p) => ({
                ...p,
                membres: p.membres.includes(id)
                  ? p.membres.filter((m) => m !== id)
                  : [...p.membres, id],
              }))
            }
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setDraft(emptyDraft());
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!draft.nom_fr.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Création…" : "Créer le groupe"}
            </Button>
          </div>
        </Card>
      )}

      <Card title={`Groupes existants — ${listQuery.data?.results.length ?? 0}`}>
        {listQuery.isLoading ? (
          <p style={{ fontSize: 13, color: "var(--gray-500)" }}>Chargement…</p>
        ) : (listQuery.data?.results ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
            Aucun groupe pour le moment. Cliquez sur <strong>+ Nouveau groupe</strong>.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {listQuery.data!.results.map((g) => (
              <GroupeRow key={g.id} groupe={g} personnes={personnes} onChange={invalidate} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function GroupeRow({
  groupe,
  personnes,
  onChange,
}: {
  groupe: GroupePersonnes;
  personnes: Personne[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const initialMembres = useMemo(
    () =>
      Array.isArray(groupe.membres)
        ? groupe.membres.map((m) => (typeof m === "string" ? m : m.id))
        : [],
    [groupe.membres],
  );
  const [draft, setDraft] = useState<DraftGroupe>({
    nom_fr: groupe.nom_fr,
    nom_en: groupe.nom_en,
    description_fr: groupe.description_fr,
    description_en: groupe.description_en,
    membres: initialMembres,
    actif: groupe.actif,
  });

  const update = useMutation({
    mutationFn: () => groupesPersonnesApi.update(groupe.id, draft),
    onSuccess: () => {
      setEditing(false);
      onChange();
    },
  });
  const remove = useMutation({
    mutationFn: () => groupesPersonnesApi.remove(groupe.id),
    onSuccess: onChange,
  });

  const membresList = groupe.membres_detail ?? [];

  if (!editing) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "12px 14px",
          border: "1px solid var(--gray-200)",
          borderRadius: 6,
          background: "var(--surface)",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--f-serif, Georgia, serif)",
              fontSize: 16,
              fontWeight: 500,
              color: "var(--ink-1, #0f1a3a)",
            }}
          >
            {groupe.nom_fr}
            <span
              style={{
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--rst-blue, #1e47a1)",
              }}
            >
              {groupe.nombre_membres ?? membresList.length} membre
              {(groupe.nombre_membres ?? membresList.length) > 1 ? "s" : ""}
            </span>
            {!groupe.actif && (
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  background: "var(--gray-100, #f3f4f6)",
                  color: "var(--gray-600, #4b5563)",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                Inactif
              </span>
            )}
          </div>
          {membresList.length > 0 && (
            <div
              style={{
                fontSize: 12,
                color: "var(--gray-600, #4b5563)",
                marginTop: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {membresList.map((p) => p.libelle).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Éditer
          </Button>
          <Button
            size="sm"
            variant="dangerOutline"
            onClick={() => {
              if (
                window.confirm(
                  `Supprimer le groupe « ${groupe.nom_fr} » ? Les cantiques qui le référencent perdront cet interprète.`,
                )
              ) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
          >
            Supprimer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--rst-blue, #1e47a1)",
        borderRadius: 6,
        background: "var(--bg-tint, #eef1f7)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="Nom FR"
          value={draft.nom_fr}
          onChange={(e) => setDraft((p) => ({ ...p, nom_fr: e.target.value }))}
        />
        <Input
          label="Nom EN"
          value={draft.nom_en}
          onChange={(e) => setDraft((p) => ({ ...p, nom_en: e.target.value }))}
        />
      </div>
      <Textarea
        label="Description FR"
        rows={2}
        value={draft.description_fr}
        onChange={(e) => setDraft((p) => ({ ...p, description_fr: e.target.value }))}
      />
      <div>
        <p style={{ fontSize: 12, color: "var(--gray-600)", margin: "0 0 8px" }}>
          Membres ({draft.membres.length}) — cocher pour ajouter, décocher pour retirer :
        </p>
        <PersonnesMultiPicker
          personnes={personnes}
          selected={new Set(draft.membres)}
          onToggle={(id) =>
            setDraft((p) => ({
              ...p,
              membres: p.membres.includes(id)
                ? p.membres.filter((m) => m !== id)
                : [...p.membres, id],
            }))
          }
        />
      </div>
      <Toggle
        checked={draft.actif}
        onChange={(v) => setDraft((p) => ({ ...p, actif: v }))}
        label="Groupe actif (visible dans les sélecteurs)"
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Annuler
        </Button>
        <Button onClick={() => update.mutate()} disabled={update.isPending}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

/** Sélecteur multi-personnes — checkbox grid simple, recherche en haut. */
function PersonnesMultiPicker({
  personnes,
  selected,
  onToggle,
}: {
  personnes: Personne[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personnes;
    return personnes.filter((p) =>
      [p.libelle, p.prenom, p.nom, p.nom_affichage].some((s) =>
        (s ?? "").toLowerCase().includes(q),
      ),
    );
  }, [personnes, search]);

  return (
    <div
      style={{
        border: "1px solid var(--gray-200)",
        borderRadius: 6,
        background: "var(--surface)",
        maxHeight: 240,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          padding: 8,
          background: "var(--surface)",
          borderBottom: "1px solid var(--gray-150, #eee)",
        }}
      >
        <input
          type="search"
          placeholder="Rechercher une personne…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            border: "1px solid var(--gray-200)",
            borderRadius: 4,
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>
      {filtered.length === 0 ? (
        <p style={{ padding: 12, fontSize: 12, color: "var(--gray-500)", margin: 0 }}>
          Aucune personne ne correspond.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 6 }}>
          {filtered.map((p) => (
            <li key={p.id}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--ink-1)",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => onToggle(p.id)}
                  style={{ accentColor: "var(--rst-blue, #1e47a1)" }}
                />
                {p.libelle}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

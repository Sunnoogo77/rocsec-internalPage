import { Modal } from "@/components/ui/Modal";
/**
 * Modal admin : gestion des événements liturgiques pour les cantiques.
 *
 * Ouverte depuis la page Cantiques via le bouton « Gérer les événements ».
 * Permet de créer/éditer/supprimer des EvenementCantique. Un événement contient
 * 0 ou plusieurs cantiques (la cardinalité est gérée par la FK Cantique.evenement,
 * pas ici — on liste juste les compteurs).
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Card, Input, Textarea, Toggle } from "@/components/ui";
import { ActionError } from "@/components/ui/ActionError";
import { evenementsCantiqueApi } from "@/api";
import type { EvenementCantique } from "@/types";

interface DraftEvenement {
  nom_fr: string;
  nom_en: string;
  description_fr: string;
  description_en: string;
  date_evenement: string;
  close: boolean;
}

function emptyDraft(): DraftEvenement {
  return {
    nom_fr: "",
    nom_en: "",
    description_fr: "",
    description_en: "",
    date_evenement: "",
    close: false,
  };
}

export function EvenementsPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal open wide onClose={onClose} title="Événements des cantiques">
      <p style={{ marginBottom: 20, color: "var(--gray-600)" }}>
        Classez les cantiques par événement : veillée, Pâques ou autre rendez-vous de l’assemblée.
      </p>
      <EvenementsContent />
    </Modal>
  );
}

function EvenementsContent() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["evenements-cantique"],
    queryFn: () => evenementsCantiqueApi.list(),
  });

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftEvenement>(emptyDraft());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["evenements-cantique"] });

  const createMutation = useMutation({
    mutationFn: () =>
      evenementsCantiqueApi.create({
        ...draft,
        date_evenement: draft.date_evenement || null,
      }),
    onSuccess: () => {
      setDraft(emptyDraft());
      setCreating(false);
      invalidate();
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {!creating ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            onClick={() => {
              createMutation.reset();
              setCreating(true);
            }}
          >
            + Nouvel événement
          </Button>
        </div>
      ) : (
        <Card title="Nouvel événement">
          <ActionError error={createMutation.error} title="L’événement n’a pas été créé." />
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
              placeholder="ex. Veillée Nouvel An 2026"
            />
            <Input
              label="Nom EN"
              value={draft.nom_en}
              onChange={(e) => setDraft((p) => ({ ...p, nom_en: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Input
              label="Date de l'événement (optionnel)"
              type="date"
              value={draft.date_evenement}
              onChange={(e) => setDraft((p) => ({ ...p, date_evenement: e.target.value }))}
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
          <div style={{ marginBottom: 14 }}>
            <Textarea
              label="Description EN"
              rows={2}
              value={draft.description_en}
              onChange={(e) => setDraft((p) => ({ ...p, description_en: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setDraft(emptyDraft());
                createMutation.reset();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!draft.nom_fr.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Création…" : "Créer l'événement"}
            </Button>
          </div>
        </Card>
      )}

      <Card title={`Événements existants — ${listQuery.data?.results.length ?? 0}`}>
        {listQuery.isLoading ? (
          <p style={{ fontSize: 13, color: "var(--gray-500)" }}>Chargement…</p>
        ) : (listQuery.data?.results ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
            Aucun événement pour le moment. Cliquez sur <strong>+ Nouvel événement</strong>.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {listQuery.data!.results.map((e) => (
              <EvenementRow key={e.id} evenement={e} onChange={invalidate} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function EvenementRow({
  evenement,
  onChange,
}: {
  evenement: EvenementCantique;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftEvenement>({
    nom_fr: evenement.nom_fr,
    nom_en: evenement.nom_en,
    description_fr: evenement.description_fr,
    description_en: evenement.description_en,
    date_evenement: evenement.date_evenement ?? "",
    close: evenement.close,
  });

  const update = useMutation({
    mutationFn: () =>
      evenementsCantiqueApi.update(evenement.id, {
        ...draft,
        date_evenement: draft.date_evenement || null,
      }),
    onSuccess: () => {
      setEditing(false);
      onChange();
    },
  });
  const remove = useMutation({
    mutationFn: () => evenementsCantiqueApi.remove(evenement.id),
    onSuccess: onChange,
  });

  if (!editing) {
    return (
      <>
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
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {evenement.nom_fr}
              {evenement.date_evenement && (
                <span style={{ marginLeft: 10, fontSize: 12, color: "var(--gray-500)" }}>
                  · {evenement.date_evenement}
                </span>
              )}
              {evenement.close && (
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
                  Clos
                </span>
              )}
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--rst-blue, #1e47a1)",
                }}
              >
                {evenement.nombre_cantiques ?? 0} cantique
                {(evenement.nombre_cantiques ?? 0) > 1 ? "s" : ""}
              </span>
            </div>
            {evenement.description_fr && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--gray-600, #4b5563)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {evenement.description_fr}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                remove.reset();
                update.reset();
                setEditing(true);
              }}
            >
              Éditer
            </Button>
            <Button
              size="sm"
              variant="dangerOutline"
              onClick={() => {
                if (
                  window.confirm(
                    `Supprimer l'événement « ${evenement.nom_fr} » ? Les cantiques associés gardent leur position dans le catalogue mais perdent leur référence à cet événement.`,
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
        <ActionError error={remove.error} title="L’événement n’a pas été supprimé." />
      </>
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
      <Input
        label="Date de l'événement"
        type="date"
        value={draft.date_evenement}
        onChange={(e) => setDraft((p) => ({ ...p, date_evenement: e.target.value }))}
      />
      <Textarea
        label="Description FR"
        rows={2}
        value={draft.description_fr}
        onChange={(e) => setDraft((p) => ({ ...p, description_fr: e.target.value }))}
      />
      <Textarea
        label="Description EN"
        rows={2}
        value={draft.description_en}
        onChange={(e) => setDraft((p) => ({ ...p, description_en: e.target.value }))}
      />
      <Toggle
        checked={draft.close}
        onChange={(v) => setDraft((p) => ({ ...p, close: v }))}
        label="Événement clos (passé)"
      />
      <ActionError error={update.error} title="L’événement n’a pas été modifié." />
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

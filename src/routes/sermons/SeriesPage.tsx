/**
 * Gestion des séries de sermons — exposée en deux modes :
 *  - `SeriesPanel` : modal/panneau coulissant ouvert depuis la page Cultes
 *    (bouton "Gérer les séries"). Utilisation principale.
 *  - `SeriesPage` : route /sermons/series (kept for direct access, plus tard).
 *
 * Liste + création + édition inline + suppression. Toggle "close" pour marquer
 * une série terminée. Le backend (`SerieViewSet`, permission
 * `PublicReadAdminWrite`) expose déjà tous les endpoints CRUD.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input, Textarea, Toggle } from "@/components/ui";
import { HttpError } from "@/api/client";
import { seriesApi } from "@/api";
import type { Serie } from "@/types";

interface DraftSerie {
  titre_fr: string;
  titre_en: string;
  description_fr: string;
  description_en: string;
  close: boolean;
}

function emptyDraft(): DraftSerie {
  return {
    titre_fr: "",
    titre_en: "",
    description_fr: "",
    description_en: "",
    close: false,
  };
}

/** Contenu interne réutilisé par la modal et la page plein écran. */
function SeriesContent() {
  const queryClient = useQueryClient();
  const seriesQuery = useQuery({
    queryKey: ["series"],
    queryFn: () => seriesApi.list(),
  });

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftSerie>(emptyDraft());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["series"] });

  const createMutation = useMutation({
    mutationFn: () => seriesApi.create(draft),
    onSuccess: () => {
      setDraft(emptyDraft());
      setCreating(false);
      invalidate();
    },
  });

  const createError = createMutation.error instanceof HttpError ? createMutation.error : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {!creating ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={() => setCreating(true)}>+ Nouvelle série</Button>
        </div>
      ) : (
        <Card title="Nouvelle série">
          {createError && (
            <div
              role="alert"
              style={{
                background: "rgba(220, 38, 38, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                color: "#991b1b",
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
              label="Titre FR"
              required
              value={draft.titre_fr}
              onChange={(e) => setDraft((p) => ({ ...p, titre_fr: e.target.value }))}
              placeholder="ex. L'Ordre de l'Église"
            />
            <Input
              label="Titre EN"
              value={draft.titre_en}
              onChange={(e) => setDraft((p) => ({ ...p, titre_en: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Textarea
              label="Description FR"
              rows={3}
              value={draft.description_fr}
              onChange={(e) => setDraft((p) => ({ ...p, description_fr: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Textarea
              label="Description EN"
              rows={3}
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
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!draft.titre_fr.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Création…" : "Créer la série"}
            </Button>
          </div>
        </Card>
      )}

      <Card title={`Séries existantes — ${seriesQuery.data?.results.length ?? 0}`}>
        {seriesQuery.isLoading ? (
          <p style={{ fontSize: 13, color: "var(--gray-500)" }}>Chargement…</p>
        ) : (seriesQuery.data?.results ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
            Aucune série pour le moment. Cliquez sur <strong>+ Nouvelle série</strong> pour commencer.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {seriesQuery.data!.results.map((s) => (
              <SerieRow key={s.id} serie={s} onChange={invalidate} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Modal centrale pour gérer les séries depuis la page Cultes. */
export function SeriesPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="seriesPanelTitle"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 24px 24px",
        overflowY: "auto",
        animation: "fadeIn 180ms ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "white",
          borderRadius: 10,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.22)",
          padding: 24,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: "1px solid var(--gray-200, #e5e7eb)",
          }}
        >
          <div>
            <h2 id="seriesPanelTitle" style={{ margin: 0, fontSize: 22, color: "var(--ink-1, #0f1a3a)" }}>
              Séries de prédications
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--gray-600, #4b5563)" }}>
              Regroupez plusieurs prédications sous un même thème. Une prédication peut
              appartenir à une série ou rester indépendante.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </header>

        <SeriesContent />
      </div>
    </div>
  );
}

/** Page plein écran (route `/sermons/series`, conservée pour accès direct). */
export function SeriesPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Cultes", to: "/sermons" },
          { label: "Séries de sermons" },
        ]}
      />
      <PageHead
        title="Séries de sermons"
        lede="Regroupez plusieurs prédications sous un même thème (ex. « L'Ordre de l'Église »). La série apparaît ensuite dans le sélecteur lors de l'édition d'un sermon."
      />
      <PageBody>
        <SeriesContent />
      </PageBody>
    </>
  );
}

/** Ligne éditable d'une série existante. Mutations directes, debouncées via "Enregistrer". */
function SerieRow({ serie, onChange }: { serie: Serie; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftSerie>({
    titre_fr: serie.titre_fr,
    titre_en: serie.titre_en,
    description_fr: serie.description_fr,
    description_en: serie.description_en,
    close: serie.close,
  });

  const update = useMutation({
    mutationFn: (body: Partial<Serie>) => seriesApi.update(serie.id, body),
    onSuccess: () => {
      setEditing(false);
      onChange();
    },
  });

  const remove = useMutation({
    mutationFn: () => seriesApi.remove(serie.id),
    onSuccess: onChange,
  });

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
          background: "white",
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
            {serie.titre_fr}
            {serie.close && (
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
                Terminée
              </span>
            )}
          </div>
          {serie.description_fr && (
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
              {serie.description_fr}
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
              if (window.confirm(`Supprimer la série « ${serie.titre_fr} » ? Les sermons associés perdront leur référence.`)) {
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
          label="Titre FR"
          value={draft.titre_fr}
          onChange={(e) => setDraft((p) => ({ ...p, titre_fr: e.target.value }))}
        />
        <Input
          label="Titre EN"
          value={draft.titre_en}
          onChange={(e) => setDraft((p) => ({ ...p, titre_en: e.target.value }))}
        />
      </div>
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
        label="Série terminée"
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setDraft({
              titre_fr: serie.titre_fr,
              titre_en: serie.titre_en,
              description_fr: serie.description_fr,
              description_en: serie.description_en,
              close: serie.close,
            });
          }}
        >
          Annuler
        </Button>
        <Button onClick={() => update.mutate(draft)} disabled={update.isPending}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

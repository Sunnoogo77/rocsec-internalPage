import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input, StatusBadge, Tabs, Textarea } from "@/components/ui";
import { MediaPickerModal } from "@/components/forms/MediaPickerModal";
import { semaineApi } from "@/api";
import { ActionError } from "@/components/ui/ActionError";
import { DateField } from "@/components/forms/DateTimeField";
import { api } from "@/api/client";
import { DiscardRevision } from "@/components/forms/DiscardRevision";
import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { hasLivePublication, publicationNotice, revisionOptions } from "@/lib/publication";
import { FormValidationError } from "@/lib/formValidation";
import { useDraftGuard } from "@/lib/useDraftGuard";
import type { ImageSemaine, StatutWorkflow, VlogSemaine, VlogSemaineTraduction } from "@/types";

/** Id stable pour brancher le `<label htmlFor>` sur l'`<input type="file">`. */
const FILE_INPUT_ID = "images-semaine-file-input";

/** Numéro de semaine ISO 8601 — utilisé pour pré-remplir le formulaire d'upload. */
function isoWeek(d: Date): { semaine: number; annee: number } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { semaine: week, annee: tmp.getUTCFullYear() };
}

export function CetteSemainePage() {
  const queryClient = useQueryClient();
  const semaineCourante = isoWeek(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useSearchParams();
  const editingId = search.get("vlog");

  const vlogs = useQuery({
    queryKey: ["vlog-list"],
    queryFn: () => semaineApi.vlogList(),
  });
  const images = useQuery({
    queryKey: ["images-semaine"],
    queryFn: () => semaineApi.imagesSemaine(),
  });

  const actif = vlogs.data?.results.find(hasLivePublication);
  const archives = (vlogs.data?.results ?? []).filter((v) => v.id !== actif?.id);
  const liste = images.data?.results ?? [];

  // ── Mutations ──────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["images-semaine"] });

  // IMPORTANT : on accepte `File[]` (pas `FileList`).
  // FileList est une référence vivante sur l'`<input>` — si on reset `value=""`
  // après avoir passé `e.target.files` à mutate(), la mutation lit un FileList vide
  // car React Query exécute mutationFn de manière async. On doit cloner en tableau
  // dans le handler `onChange` AVANT de toucher au input.
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      console.info(`[CetteSemaine] Upload de ${files.length} fichier(s)…`);
      const ordreBase = liste.length;
      const results = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.info(`[CetteSemaine] POST ${file.name} (${(file.size / 1024).toFixed(0)} ko)…`);
        const form = new FormData();
        form.append("image", file);
        form.append("ordre", String(ordreBase + i + 1));
        form.append("semaine_iso", String(semaineCourante.semaine));
        form.append("annee", String(semaineCourante.annee));
        form.append("actif", "true");
        try {
          const created = await semaineApi.imageCreate(form);
          console.info(`[CetteSemaine] ✓ ${file.name} → id=${created.id}`);
          results.push(created);
        } catch (err) {
          console.error(`[CetteSemaine] ✗ ${file.name} :`, err);
          throw err;
        }
      }
      return results;
    },
    onSuccess: invalidate,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ImageSemaine> }) =>
      semaineApi.imageUpdate(id, body),
    onSuccess: invalidate,
  });

  const importMutation = useMutation({
    mutationFn: (mediaIds: string[]) =>
      semaineApi.importFromMedia(
        mediaIds,
        semaineCourante.semaine,
        semaineCourante.annee,
        liste.length,
      ),
    onSuccess: () => {
      invalidate();
      setPickerOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => semaineApi.imageDelete(id),
    onSuccess: invalidate,
  });

  const move = (img: ImageSemaine, delta: -1 | 1) => {
    const sorted = [...liste].sort((a, b) => a.ordre - b.ordre);
    const idx = sorted.findIndex((x) => x.id === img.id);
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    // Échange des ordres
    patchMutation.mutate({ id: img.id, body: { ordre: other.ordre } });
    patchMutation.mutate({ id: other.id, body: { ordre: img.ordre } });
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Cette semaine" }]} />
      <PageHead
        title="Cette semaine"
        lede={`Vlog hebdomadaire + galerie de 6 photos. Semaine courante : S${semaineCourante.semaine}/${semaineCourante.annee}.`}
      />

      {/* Input file global hors PageHead pour être sûr qu'il reste monté.
          Référencé par le <label htmlFor=...> du bouton "Ajouter des photos". */}
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept="image/*"
        multiple
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          opacity: 0,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
          pointerEvents: "none",
        }}
        onChange={(e) => {
          // Cloner IMMÉDIATEMENT en tableau, avant de reset e.target.value
          // (FileList est une référence vivante sur l'input).
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          console.info("[CetteSemaine] onChange input file :", files.length, "fichier(s)");
          if (files.length > 0) {
            uploadMutation.mutate(files);
          }
        }}
      />
      <PageBody>
        <QueryFeedback
          loading={images.isLoading}
          error={images.error}
          retry={() => void images.refetch()}
        />
        <QueryFeedback
          loading={vlogs.isLoading}
          error={vlogs.error}
          retry={() => void vlogs.refetch()}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {actif ? (
            <Card
              title={`Vlog actif — Semaine du ${dayjs(actif.date_culte).format("DD MMM YYYY")}`}
              actions={
                <>
                  <StatusBadge statut={actif.statut as StatutWorkflow} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSearch({ vlog: actif.id })}
                  >
                    {actif.revision ? "Reprendre la correction" : "Modifier le vlog"}
                  </Button>
                </>
              }
            >
              <p style={{ fontSize: 14, color: "var(--gray-700)", marginBottom: 8 }}>
                {actif.traductions?.[0]?.titre_message ?? "—"}
              </p>
              <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
                Réalisé par {actif.traductions?.[0]?.predicateur_libelle ?? "—"} ·{" "}
                {actif.traductions?.[0]?.serie ?? "—"}
              </div>
              {actif.revision && (
                <p role="status" style={{ marginTop: 12 }}>
                  Une correction est en préparation. La version publiée reste visible sur le site.
                </p>
              )}
            </Card>
          ) : (
            <Card title="Aucun vlog actif">
              <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                Créez un vlog hebdomadaire et publiez-le pour qu'il apparaisse sur la vitrine. (Page
                d'accueil et "Cette semaine" tirent désormais le dernier sermon publié dans les 8
                derniers jours, indépendamment du vlog.)
              </p>
            </Card>
          )}

          {editingId && <VlogEditor key={editingId} id={editingId} onClose={() => setSearch({})} />}

          <Card
            title={`Galerie de la semaine — ${liste.length} image(s)`}
            actions={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    importMutation.reset();
                    setPickerOpen(true);
                  }}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? "Import…" : "Depuis la médiathèque"}
                </Button>
                <label
                  htmlFor={FILE_INPUT_ID}
                  aria-disabled={uploadMutation.isPending}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 36,
                    padding: "0 14px",
                    background: uploadMutation.isPending
                      ? "var(--gray-300, #d1d5db)"
                      : "var(--rst-blue, #1e47a1)",
                    color: "white",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    cursor: uploadMutation.isPending ? "not-allowed" : "pointer",
                    userSelect: "none",
                    transition: "background 150ms",
                  }}
                >
                  {uploadMutation.isPending ? "Envoi…" : "+ Ajouter depuis l'ordinateur"}
                </label>
              </div>
            }
          >
            <p style={{ fontSize: 13, color: "var(--gray-600)", margin: "0 0 16px" }}>
              La vitrine affiche les images marquées <em>actif=true</em>, triées par ordre
              croissant. Les images <em>est_grande=true</em> occupent 2× l'espace dans la mosaïque.
              Les uploads sont rattachés à la semaine courante (S
              {semaineCourante.semaine}/{semaineCourante.annee}).
            </p>

            <ActionError
              error={uploadMutation.error || patchMutation.error || deleteMutation.error}
            />

            {liste.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 32,
                  border: "1px dashed var(--gray-300)",
                  borderRadius: 8,
                  color: "var(--gray-500)",
                  fontSize: 13,
                }}
              >
                Aucune image. Utilisez <strong>+ Ajouter depuis l'ordinateur</strong> pour
                téléverser des images, ou <strong>Depuis la médiathèque</strong> pour réutiliser des
                images déjà importées.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 14,
                }}
              >
                {[...liste]
                  .sort((a, b) => a.ordre - b.ordre)
                  .map((img, idx, arr) => (
                    <ImageCard
                      key={img.id}
                      img={img}
                      isFirst={idx === 0}
                      isLast={idx === arr.length - 1}
                      onMoveUp={() => move(img, -1)}
                      onMoveDown={() => move(img, 1)}
                      onPatch={(body) => patchMutation.mutate({ id: img.id, body })}
                      onDelete={() => {
                        if (window.confirm(`Supprimer l'image "${img.caption_fr || img.id}" ?`)) {
                          deleteMutation.mutate(img.id);
                        }
                      }}
                    />
                  ))}
              </div>
            )}
          </Card>

          <Card title={`Autres vlogs et brouillons — ${archives.length}`}>
            {archives.length ? (
              <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {archives.map((vlog) => (
                  <li key={vlog.id} style={{ fontSize: 13, color: "var(--gray-600)" }}>
                    {dayjs(vlog.date_culte).format("DD MMM YYYY")} —{" "}
                    {vlog.traductions?.[0]?.titre_message ?? "(sans titre)"}{" "}
                    <StatusBadge statut={vlog.statut as StatutWorkflow} />{" "}
                    <Button variant="ghost" size="sm" onClick={() => setSearch({ vlog: vlog.id })}>
                      Ouvrir le vlog du {dayjs(vlog.date_culte).format("DD MMM YYYY")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "var(--gray-500)" }}>Aucune archive.</p>
            )}
          </Card>
        </div>
      </PageBody>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(ids) => importMutation.mutate(ids)}
        error={importMutation.error}
        pending={importMutation.isPending}
        confirmLabel="Importer dans la galerie"
      />
    </>
  );
}

function blankVlogTranslation(langue: "fr" | "en"): VlogSemaineTraduction {
  return {
    langue,
    titre_message: "",
    titre_suffix: "",
    pitch_message: "",
    serie: "",
    predicateur_libelle: "",
    verset_reference: "",
    verset_texte: "",
    fil_paragraphe1: "",
    fil_paragraphe2: "",
    fil_versets: [],
    temoignage_auteur: "",
    temoignage_texte: "",
  };
}

type VlogDraft = Pick<VlogSemaine, "date_culte" | "heure_culte" | "replay_url" | "traductions">;

function VlogEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const cache = useQueryClient();
  const endpoint = `/vlog-semaine/admin/${id}/`;
  const query = useQuery({ queryKey: ["vlog", id], queryFn: () => semaineApi.vlogGet(id) });
  const access = useWorkflowAccess();
  const [draft, setDraft] = useState<VlogDraft | null>(null);
  const [editingVersion, setEditingVersion] = useState(0);
  if (query.data && draft === null) {
    setDraft({
      date_culte: query.data.date_culte,
      heure_culte: query.data.heure_culte,
      replay_url: query.data.replay_url,
      traductions: (["fr", "en"] as const).map(
        (langue) =>
          query.data.traductions.find((translation) => translation.langue === langue) ??
          blankVlogTranslation(langue),
      ),
    });
    setEditingVersion(query.data.revision_version ?? query.data.revision?.version ?? 0);
  }
  const guard = useDraftGuard(draft, draft !== null);
  const options = () => revisionOptions({ statut: "", revision_version: editingVersion });
  const accept = (saved: VlogSemaine) => {
    cache.setQueryData(["vlog", id], saved);
    setEditingVersion(saved.revision_version ?? saved.revision?.version ?? 0);
    void cache.invalidateQueries({ queryKey: ["vlog-list"] });
  };
  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Le vlog est en cours de chargement.");
      const fields: Record<string, string> = {};
      if (!draft.date_culte) fields.date_culte = "Choisissez la date du culte.";
      if (!draft.heure_culte) fields.heure_culte = "Choisissez l’heure du culte.";
      if (!draft.traductions[0].titre_message.trim())
        fields.titre = "Renseignez le titre en français.";
      if (Object.keys(fields).length) throw new FormValidationError(fields);
      return api.patch<VlogSemaine>(
        endpoint,
        {
          ...draft,
          traductions: draft.traductions.filter(
            (translation) => translation.langue === "fr" || translation.titre_message.trim(),
          ),
        },
        options(),
      );
    },
    onSuccess: (saved) => {
      accept(saved);
      guard.markSaved();
    },
  });
  const decision = useMutation({
    mutationFn: (action: "soumettre" | "publier") =>
      api.post<VlogSemaine>(`${endpoint}${action}/`, undefined, options()),
    onSuccess: accept,
  });
  const busy = save.isPending || decision.isPending;
  if (!query.data || !draft)
    return (
      <Card title="Modifier le vlog">
        <QueryFeedback
          loading={query.isLoading}
          error={query.error}
          retry={() => void query.refetch()}
        />
      </Card>
    );
  const item = query.data;
  const canDecide = ["brouillon", "en_revue", "rejete"].includes(item.statut);
  const updateTranslation = (index: number, patch: Partial<VlogSemaineTraduction>) =>
    setDraft(
      (previous) =>
        previous && {
          ...previous,
          traductions: previous.traductions.map((translation, i) =>
            i === index ? { ...translation, ...patch } : translation,
          ),
        },
    );
  return (
    <Card
      title="Modifier le vlog"
      actions={
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (
              !guard.dirty ||
              window.confirm("Quitter sans enregistrer les modifications du vlog ?")
            )
              onClose();
          }}
        >
          Fermer l’édition
        </Button>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <ActionError error={save.error || decision.error} />
        <p role="status">{publicationNotice(item, guard.dirty, save.isSuccess)}</p>
        <fieldset
          disabled={busy}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 16 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <DateField
              label="Date du culte"
              required
              value={draft.date_culte}
              onChange={(value) => setDraft({ ...draft, date_culte: value })}
            />
            <Input
              label="Heure du culte"
              type="time"
              required
              value={draft.heure_culte.slice(0, 5)}
              onChange={(event) => setDraft({ ...draft, heure_culte: event.target.value })}
            />
          </div>
          <Input
            label="Lien du replay"
            type="url"
            value={draft.replay_url}
            onChange={(event) => setDraft({ ...draft, replay_url: event.target.value })}
          />
          <Tabs
            items={draft.traductions.map((translation, index) => ({
              value: translation.langue,
              label: translation.langue === "fr" ? "Français" : "English",
              content: (
                <div style={{ display: "grid", gap: 12 }}>
                  <Input
                    label="Titre du vlog"
                    required={translation.langue === "fr"}
                    value={translation.titre_message}
                    onChange={(event) =>
                      updateTranslation(index, { titre_message: event.target.value })
                    }
                  />
                  <Input
                    label="Complément du titre"
                    value={translation.titre_suffix}
                    onChange={(event) =>
                      updateTranslation(index, { titre_suffix: event.target.value })
                    }
                  />
                  <Textarea
                    label="Présentation du message"
                    value={translation.pitch_message}
                    onChange={(event) =>
                      updateTranslation(index, { pitch_message: event.target.value })
                    }
                  />
                  <Input
                    label="Série"
                    value={translation.serie}
                    onChange={(event) => updateTranslation(index, { serie: event.target.value })}
                  />
                  <Input
                    label="Nom du prédicateur affiché"
                    value={translation.predicateur_libelle}
                    onChange={(event) =>
                      updateTranslation(index, { predicateur_libelle: event.target.value })
                    }
                  />
                  <Input
                    label="Référence du verset"
                    value={translation.verset_reference}
                    onChange={(event) =>
                      updateTranslation(index, { verset_reference: event.target.value })
                    }
                  />
                  <Textarea
                    label="Texte du verset"
                    value={translation.verset_texte}
                    onChange={(event) =>
                      updateTranslation(index, { verset_texte: event.target.value })
                    }
                  />
                  <Textarea
                    label="Fil conducteur — premier paragraphe"
                    value={translation.fil_paragraphe1}
                    onChange={(event) =>
                      updateTranslation(index, { fil_paragraphe1: event.target.value })
                    }
                  />
                  <Textarea
                    label="Fil conducteur — second paragraphe"
                    value={translation.fil_paragraphe2}
                    onChange={(event) =>
                      updateTranslation(index, { fil_paragraphe2: event.target.value })
                    }
                  />
                  <Textarea
                    label="Versets du fil conducteur"
                    help="Une référence par ligne."
                    value={translation.fil_versets.join("\n")}
                    onChange={(event) =>
                      updateTranslation(index, { fil_versets: event.target.value.split("\n") })
                    }
                  />
                  <Input
                    label="Auteur du témoignage"
                    value={translation.temoignage_auteur}
                    onChange={(event) =>
                      updateTranslation(index, { temoignage_auteur: event.target.value })
                    }
                  />
                  <Textarea
                    label="Texte du témoignage"
                    value={translation.temoignage_texte}
                    onChange={(event) =>
                      updateTranslation(index, { temoignage_texte: event.target.value })
                    }
                  />
                </div>
              ),
            }))}
          />
        </fieldset>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Button disabled={busy} onClick={() => save.mutate()}>
            {save.isPending ? "Enregistrement…" : "Enregistrer le vlog"}
          </Button>
          {canDecide && access.validator && (
            <Button
              variant="success"
              disabled={busy || guard.dirty || !access.canValidate}
              onClick={() => {
                if (window.confirm("Publier le vlog enregistré sur la vitrine ?"))
                  decision.mutate("publier");
              }}
            >
              {hasLivePublication(item) ? "Publier la correction" : "Publier le vlog"}
            </Button>
          )}
          {canDecide && item.statut !== "en_revue" && !access.validator && (
            <Button
              variant="secondary"
              disabled={busy || guard.dirty}
              onClick={() => decision.mutate("soumettre")}
            >
              Soumettre à validation
            </Button>
          )}
          {access.validator && !access.recent && <IdentityCheck />}
          <DiscardRevision
            item={item}
            endpoint={endpoint}
            listPath="/cette-semaine"
            version={editingVersion}
            busy={busy}
          />
        </div>
      </div>
    </Card>
  );
}

/** Card éditable d'une image de la semaine : preview + captions inline + actions. */
function ImageCard({
  img,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onPatch,
  onDelete,
}: {
  img: ImageSemaine;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPatch: (body: Partial<ImageSemaine>) => void;
  onDelete: () => void;
}) {
  const [captionFr, setCaptionFr] = useState(img.caption_fr);
  const [captionEn, setCaptionEn] = useState(img.caption_en);
  const dirty = captionFr !== img.caption_fr || captionEn !== img.caption_en;

  return (
    <div
      style={{
        border: "1px solid var(--gray-200)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          aspectRatio: img.est_grande ? "16/9" : "4/3",
          background: "var(--gray-100)",
          position: "relative",
        }}
      >
        {img.image_url ? (
          <img
            src={img.image_url}
            alt={img.caption}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "var(--gray-400)",
              fontSize: 12,
            }}
          >
            {img.caption_fr || `Emplacement ${img.ordre}`}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(0,0,0,0.65)",
            color: "white",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 7px",
            borderRadius: 4,
            letterSpacing: 0.5,
          }}
        >
          #{img.ordre}
          {img.est_grande ? " · GRANDE" : ""}
          {!img.actif ? " · MASQUÉE" : ""}
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <Input
          label="Légende (FR)"
          value={captionFr}
          onChange={(e) => setCaptionFr(e.target.value)}
          placeholder="ex. Chœur du dimanche"
        />
        <Input
          label="Légende (EN)"
          value={captionEn}
          onChange={(e) => setCaptionEn(e.target.value)}
          placeholder="optional"
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Monter dans l'ordre d'affichage"
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onMoveDown}
            disabled={isLast}
            title="Descendre dans l'ordre d'affichage"
          >
            ↓
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPatch({ est_grande: !img.est_grande })}
            title="Bascule emplacement 2x dans la mosaïque"
          >
            {img.est_grande ? "Réduire" : "Agrandir"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPatch({ actif: !img.actif })}
            title="Masque l'image côté vitrine sans la supprimer"
          >
            {img.actif ? "Masquer" : "Réafficher"}
          </Button>
          <div style={{ flex: 1 }} />
          {dirty && (
            <Button
              size="sm"
              onClick={() => onPatch({ caption_fr: captionFr, caption_en: captionEn })}
            >
              Enregistrer
            </Button>
          )}
          <Button size="sm" variant="dangerOutline" onClick={onDelete}>
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
}

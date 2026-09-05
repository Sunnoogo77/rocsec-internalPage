import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input, StatusBadge } from "@/components/ui";
import { MediaPickerModal } from "@/components/forms/MediaPickerModal";
import { semaineApi } from "@/api";
import { HttpError } from "@/api/client";
import type { ImageSemaine, StatutWorkflow } from "@/types";

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

  const vlogs = useQuery({
    queryKey: ["vlog-list"],
    queryFn: () => semaineApi.vlogList(),
  });
  const images = useQuery({
    queryKey: ["images-semaine"],
    queryFn: () => semaineApi.imagesSemaine(),
  });

  const actif = vlogs.data?.results.find((v) => v.statut === "publie");
  const archives = (vlogs.data?.results ?? []).filter((v) => v.statut !== "publie");
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
  const uploadError = uploadMutation.error instanceof HttpError ? uploadMutation.error : null;

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
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {actif ? (
            <Card
              title={`Vlog actif — Semaine du ${dayjs(actif.date_culte).format("DD MMM YYYY")}`}
              actions={<StatusBadge statut={actif.statut as StatutWorkflow} />}
            >
              <p style={{ fontSize: 14, color: "var(--gray-700)", marginBottom: 8 }}>
                {actif.traductions?.[0]?.titre_message ?? "—"}
              </p>
              <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
                Réalisé par {actif.traductions?.[0]?.predicateur_libelle ?? "—"} ·{" "}
                {actif.traductions?.[0]?.serie ?? "—"}
              </div>
            </Card>
          ) : (
            <Card title="Aucun vlog actif">
              <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                Créez un vlog hebdomadaire et publiez-le pour qu'il apparaisse sur la vitrine.
                (Page d'accueil et "Cette semaine" tirent désormais le dernier sermon publié
                dans les 8 derniers jours, indépendamment du vlog.)
              </p>
            </Card>
          )}

          <Card
            title={`Galerie de la semaine — ${liste.length} image(s)`}
            actions={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
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
                    background: uploadMutation.isPending ? "var(--gray-300, #d1d5db)" : "var(--rst-blue, #1e47a1)",
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
              croissant. Les images <em>est_grande=true</em> occupent 2× l'espace dans la
              mosaïque. Les uploads sont rattachés à la semaine courante (S
              {semaineCourante.semaine}/{semaineCourante.annee}).
            </p>

            {uploadError && (
              <div
                role="alert"
                style={{
                  background: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid rgba(220, 38, 38, 0.25)",
                  color: "#991b1b",
                  borderRadius: 6,
                  padding: "10px 14px",
                  margin: "0 0 16px",
                  fontSize: 13,
                }}
              >
                <strong>L'upload a échoué :</strong> {uploadError.message}
                {uploadError.details && Object.keys(uploadError.details).length > 0 && (
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    {Object.entries(uploadError.details).map(([field, msg]) => (
                      <li key={field}>
                        <em>{field}</em> : {Array.isArray(msg) ? msg.join(" ; ") : String(msg)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
                téléverser des images, ou <strong>Depuis la médiathèque</strong> pour
                réutiliser des images déjà importées.
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

          <Card title={`Archives — ${archives.length} ancien(s) vlog(s)`}>
            {archives.length ? (
              <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {archives.map((vlog) => (
                  <li key={vlog.id} style={{ fontSize: 13, color: "var(--gray-600)" }}>
                    {dayjs(vlog.date_culte).format("DD MMM YYYY")} —{" "}
                    {vlog.traductions?.[0]?.titre_message ?? "(sans titre)"}
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
        confirmLabel="Importer dans la galerie"
      />
    </>
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
        background: "white",
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

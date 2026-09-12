import { ActionError } from "@/components/ui/ActionError";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload } from "lucide-react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card } from "@/components/ui";
import { mediasApi } from "@/api";

const MEDIA_FILE_INPUT_ID = "mediatheque-file-input";

const VISUALLY_HIDDEN: React.CSSProperties = {
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
};

export function MediathequePage() {
  const access = useWorkflowAccess();
  const [feedback, setFeedback] = useState("");
  const [transferError, setTransferError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["medias-list", page],
    queryFn: () => mediasApi.list({ page, page_size: 24 }),
  });

  /** Upload séquentiel pour conserver l'ordre + tolérer les fichiers individuels qui plantent.
   *  Accepte `File[]` (pas `FileList`) : voir commentaire CetteSemaine.tsx. */
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      console.info(`[Médiathèque] Upload de ${files.length} fichier(s)…`);
      const out = [];
      const failed: string[] = [];
      setFeedback("");
      setTransferError(null);
      for (const file of files) {
        setUploadingCount((n) => n + 1);
        try {
          console.info(`[Médiathèque] POST ${file.name} (${(file.size / 1024).toFixed(0)} ko)…`);
          out.push(await mediasApi.upload(file));
        } catch (err) {
          failed.push(file.name);
          setTransferError(err);
          console.error("Échec d’envoi", err);
        } finally {
          setUploadingCount((n) => n - 1);
        }
      }
      setFeedback(
        failed.length
          ? `${out.length} image(s) ajoutée(s). Échec pour : ${failed.join(", ")}. Réessayez ces fichiers.`
          : `${out.length} image(s) ajoutée(s).`,
      );
      return out;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["medias-list"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => mediasApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["medias-list"] }),
  });

  const removeSelection = async () => {
    if (selectedIds.size === 0 || !access.canManage) return;
    if (!window.confirm(`Supprimer ${selectedIds.size} média(s) sélectionné(s) ?`)) return;
    setDeleting(true);
    setTransferError(null);
    const failed = new Set<string>();
    for (const id of Array.from(selectedIds)) {
      try {
        await mediasApi.remove(id);
      } catch (err) {
        failed.add(id);
        setTransferError(err);
        console.error("Suppression échouée", err);
      }
    }
    setSelectedIds(failed);
    setDeleting(false);
    setFeedback(
      failed.size
        ? `${failed.size} image(s) n’ont pas pu être supprimées. Elles restent sélectionnées.`
        : "Sélection supprimée.",
    );
    void queryClient.invalidateQueries({ queryKey: ["medias-list"] });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const uploading = uploadingCount > 0;

  return (
    <>
      <Breadcrumb items={[{ label: "Médiathèque" }]} />
      <PageHead
        title="Médiathèque"
        lede="Retrouvez les images de l’équipe. Cochez les vignettes pour sélectionner plusieurs fichiers."
        actions={
          <>
            <input
              id={MEDIA_FILE_INPUT_ID}
              type="file"
              accept="image/*"
              multiple
              style={VISUALLY_HIDDEN}
              onChange={(event) => {
                // Cloner avant reset (FileList est une référence vivante).
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                console.info("[Médiathèque] onChange :", files.length, "fichier(s)");
                if (files.length > 0) {
                  upload.mutate(files);
                }
              }}
            />
            {selectedIds.size > 0 && (
              <Button
                variant="dangerOutline"
                size="sm"
                disabled={!access.canManage || deleting}
                onClick={removeSelection}
              >
                Supprimer la sélection ({selectedIds.size})
              </Button>
            )}
            <label
              htmlFor={MEDIA_FILE_INPUT_ID}
              aria-disabled={uploading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 36,
                padding: "0 14px",
                background: uploading ? "var(--gray-300, #d1d5db)" : "var(--rst-blue, #1e47a1)",
                color: "white",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                cursor: uploading ? "not-allowed" : "pointer",
                userSelect: "none",
                transition: "background 150ms",
              }}
            >
              <Upload size={14} />
              {uploading
                ? `Téléversement (${uploadingCount} en cours)…`
                : "Téléverser un ou plusieurs médias"}
            </label>
          </>
        }
      />
      <PageBody>
        <ActionError error={transferError} />
        {feedback && (
          <p role="status" className="securityNotice">
            {feedback}
          </p>
        )}
        <ActionError error={remove.error} />
        {access.validator && !access.recent && (
          <div className="securityNotice">
            <p>La suppression nécessite une vérification récente de votre identité.</p>
            <IdentityCheck />
          </div>
        )}
        <QueryFeedback
          loading={query.isLoading}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isSuccess && (
          <Card title={`${query.data.count} médias`}>
            {!query.data.results.length && (
              <p>Aucune image enregistrée. Ajoutez des fichiers à la bibliothèque.</p>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {(query.data?.results ?? []).map((media) => {
                const isSelected = selectedIds.has(media.id);
                return (
                  <div
                    key={media.id}
                    onClick={(e) => {
                      // Ctrl/⌘+clic ou simple clic sur la vignette = toggle de sélection.
                      if (e.ctrlKey || e.metaKey || isSelected) {
                        e.preventDefault();
                        toggleSelected(media.id);
                      }
                    }}
                    style={{
                      border: isSelected
                        ? "2px solid var(--rst-blue, #1e47a1)"
                        : "1px solid var(--gray-200)",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "var(--surface)",
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                      position: "relative",
                      transition: "border-color 150ms, box-shadow 150ms",
                      boxShadow: isSelected ? "0 0 0 3px rgba(30, 71, 161, 0.15)" : "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(media.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        width: 18,
                        height: 18,
                        cursor: "pointer",
                        zIndex: 1,
                        accentColor: "var(--rst-blue, #1e47a1)",
                      }}
                      aria-label={`Sélectionner ${media.nom}`}
                    />
                    <div
                      style={{
                        aspectRatio: "4/3",
                        background: "var(--gray-100)",
                        overflow: "hidden",
                      }}
                    >
                      {media.variantes.thumbnail ? (
                        <img
                          src={media.variantes.thumbnail}
                          alt={media.alt}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                    <div style={{ padding: 8, fontSize: 12, color: "var(--gray-700)" }}>
                      <div style={{ fontWeight: 500, color: "var(--gray-900)", marginBottom: 4 }}>
                        {media.nom}
                      </div>
                      <div style={{ color: "var(--gray-500)" }}>
                        {media.largeur}×{media.hauteur} · {Math.round(media.taille_octets / 1024)}{" "}
                        ko
                      </div>
                    </div>
                    <div style={{ padding: 8, borderTop: "1px solid var(--gray-150)" }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!access.canManage || remove.isPending}
                        leftIcon={<Trash2 size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Supprimer ce média ?")) {
                            remove.mutate(media.id);
                          }
                        }}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => {
                  setPage(page - 1);
                  setSelectedIds(new Set());
                }}
              >
                Précédente
              </Button>
              <span>Page {page}</span>
              <Button
                variant="ghost"
                disabled={!query.data.next}
                onClick={() => {
                  setPage(page + 1);
                  setSelectedIds(new Set());
                }}
              >
                Suivante
              </Button>
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}

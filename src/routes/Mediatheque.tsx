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
  const queryClient = useQueryClient();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["medias-list"],
    queryFn: () => mediasApi.list({ page_size: 100 }),
  });

  /** Upload séquentiel pour conserver l'ordre + tolérer les fichiers individuels qui plantent.
   *  Accepte `File[]` (pas `FileList`) : voir commentaire CetteSemaine.tsx. */
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      console.info(`[Médiathèque] Upload de ${files.length} fichier(s)…`);
      const out = [];
      for (const file of files) {
        setUploadingCount((n) => n + 1);
        try {
          console.info(`[Médiathèque] POST ${file.name} (${(file.size / 1024).toFixed(0)} ko)…`);
          out.push(await mediasApi.upload(file));
        } catch (err) {
          console.error(`[Médiathèque] ✗ ${file.name} :`, err);
        } finally {
          setUploadingCount((n) => n - 1);
        }
      }
      return out;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["medias-list"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => mediasApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["medias-list"] }),
  });

  const removeSelection = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Supprimer ${selectedIds.size} média(s) sélectionné(s) ?`)) return;
    for (const id of Array.from(selectedIds)) {
      try {
        await mediasApi.remove(id);
      } catch (err) {
        console.error("[Médiathèque] suppression échouée :", id, err);
      }
    }
    setSelectedIds(new Set());
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
        lede="Bibliothèque centrale d'images. Sélection multiple via Ctrl/⌘+clic. Variantes responsives générées automatiquement (320 / 768 / 1600)."
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
              <Button variant="dangerOutline" size="sm" onClick={removeSelection}>
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
              {uploading ? `Téléversement (${uploadingCount} en cours)…` : "Téléverser un ou plusieurs médias"}
            </label>
          </>
        }
      />
      <PageBody>
        <Card title={`${query.data?.count ?? 0} médias`}>
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
                    background: "#fff",
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
                      {media.largeur}×{media.hauteur} ·{" "}
                      {Math.round(media.taille_octets / 1024)} ko
                    </div>
                  </div>
                  <div style={{ padding: 8, borderTop: "1px solid var(--gray-150)" }}>
                    <Button
                      size="sm"
                      variant="ghost"
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
        </Card>
      </PageBody>
    </>
  );
}

/**
 * MediaPickerModal — sélecteur multi-images depuis la Médiathèque.
 *
 * Affiche la liste des médias en grille, permet de sélectionner via Ctrl+clic
 * ou cases à cocher, puis renvoie les IDs sélectionnés au parent via `onConfirm`.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card } from "@/components/ui";
import { mediasApi } from "@/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (mediaIds: string[]) => void;
  /** Titre du bouton de validation, ex. "Importer dans la galerie". */
  confirmLabel?: string;
  /** Limite max de sélection (optionnel). */
  maxSelection?: number;
}

export function MediaPickerModal({
  open,
  onClose,
  onConfirm,
  confirmLabel = "Importer la sélection",
  maxSelection,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["medias-picker"],
    queryFn: () => mediasApi.list({ page_size: 200 }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      return;
    }
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
  }, [open, onClose]);

  if (!open) return null;

  const toggleId = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (maxSelection !== undefined && next.size >= maxSelection) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const orderedSelection = Array.from(selected);
  const items = query.data?.results ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mediaPickerTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1450,
        background: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 24px 24px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          maxHeight: "calc(100vh - 84px)",
          background: "white",
          borderRadius: 10,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "20px 24px 14px",
            borderBottom: "1px solid var(--gray-200, #e5e7eb)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div>
            <h2 id="mediaPickerTitle" style={{ margin: 0, fontSize: 20, color: "var(--ink-1, #0f1a3a)" }}>
              Choisir des images depuis la médiathèque
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--gray-600, #4b5563)" }}>
              Cliquez sur les vignettes pour les sélectionner. L'ordre de sélection sera
              respecté dans la galerie.
              {maxSelection !== undefined && ` Maximum ${maxSelection} images.`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <Card title={`${items.length} média(s) disponible(s)`}>
            {query.isLoading ? (
              <p style={{ fontSize: 13, color: "var(--gray-500)" }}>Chargement…</p>
            ) : items.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                La médiathèque est vide. Téléversez des images depuis <strong>Médiathèque</strong> dans
                la sidebar avant d'utiliser ce sélecteur.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: 10,
                }}
              >
                {items.map((m) => {
                  const isSel = selected.has(m.id);
                  const selIdx = orderedSelection.indexOf(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleId(m.id)}
                      style={{
                        position: "relative",
                        border: isSel ? "2px solid var(--rst-blue, #1e47a1)" : "1px solid var(--gray-200)",
                        borderRadius: 6,
                        padding: 0,
                        overflow: "hidden",
                        background: "white",
                        cursor: "pointer",
                        boxShadow: isSel ? "0 0 0 3px rgba(30, 71, 161, 0.18)" : "none",
                        transition: "border-color 150ms, box-shadow 150ms",
                      }}
                      aria-pressed={isSel}
                      aria-label={`${isSel ? "Désélectionner" : "Sélectionner"} ${m.nom}`}
                    >
                      <div
                        style={{
                          aspectRatio: "4/3",
                          background: "var(--gray-100)",
                          overflow: "hidden",
                        }}
                      >
                        {m.variantes.thumbnail ? (
                          <img
                            src={m.variantes.thumbnail}
                            alt={m.alt || m.nom}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : null}
                      </div>
                      <div
                        style={{
                          padding: 6,
                          fontSize: 11,
                          color: "var(--gray-700)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          textAlign: "left",
                        }}
                      >
                        {m.nom}
                      </div>
                      {isSel && (
                        <span
                          style={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "var(--rst-blue, #1e47a1)",
                            color: "white",
                            fontSize: 12,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px solid white",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          }}
                        >
                          {selIdx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <footer
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--gray-200, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            background: "var(--gray-50, #f9fafb)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--gray-600)" }}>
            {selected.size === 0
              ? "Aucune sélection"
              : `${selected.size} image${selected.size > 1 ? "s" : ""} sélectionnée${selected.size > 1 ? "s" : ""}`}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={() => onConfirm(orderedSelection)}
              disabled={selected.size === 0}
            >
              {confirmLabel} ({selected.size})
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

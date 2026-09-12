import { DiscardRevision } from "@/components/forms/DiscardRevision";
import { DateTimeField } from "@/components/forms/DateTimeField";
import { FormValidationError } from "@/lib/formValidation";
import { churchNow, toChurchDateTime, churchDateTimeToISO } from "@/lib/churchTime";
import { hasLivePublication, publicationNotice, revisionOptions } from "@/lib/publication";
import { ActionError } from "@/components/ui/ActionError";
import { SaveFooter } from "@/components/forms/SaveFooter";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { useDraftGuard } from "@/lib/useDraftGuard";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Input, Select, StatusBadge, Tabs, Textarea, Toggle } from "@/components/ui";
import { annoncesApi, mediasApi } from "@/api";
import type { Annonce, AnnonceTraduction, ContentBlock, StatutWorkflow } from "@/types";
import common from "../common.module.css";

// `position: fixed` (et non absolute) : l'input invisible est retiré du flux
// ET ancré au viewport, donc il n'agrandit jamais la hauteur du document
// (sinon une 2e scrollbar apparaît en bas des pages longues).
const HIDDEN_FILE: React.CSSProperties = {
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
  border: 0,
  pointerEvents: "none",
};

/** Éditeur du compte-rendu : suite de blocs paragraphe / image, réordonnables. */
function ContentBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);

  const addParagraph = () => onChange([...blocks, { kind: "paragraph", text: "" }]);

  const addVideo = () => onChange([...blocks, { kind: "video", url: "", caption: "" }]);

  const addImageFromFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const media = await mediasApi.upload(file);
      // On utilise la variante "full" (URL absolue) comme src du bloc image.
      const src = media.variantes.full || media.variantes.medium || media.url || "";
      onChange([...blocks, { kind: "image", src, alt: media.nom || "", size: "wide" }]);
    } catch (err) {
      setUploadError(err);
    } finally {
      setUploading(false);
    }
  };

  const patchAt = (idx: number, patch: Partial<ContentBlock>) =>
    onChange(blocks.map((b, i) => (i === idx ? ({ ...b, ...patch } as ContentBlock) : b)));
  const removeAt = (idx: number) => onChange(blocks.filter((_, i) => i !== idx));
  const move = (idx: number, delta: -1 | 1) => {
    const j = idx + delta;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const fileId = "content-block-image-input";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ActionError error={uploadError} title="L’image n’a pas été ajoutée." />
      {blocks.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gray-500)", margin: 0 }}>
          Aucun bloc. Le compte-rendu se rédige après l'événement : ajoute des paragraphes et
          intercale des photos.
        </p>
      ) : (
        blocks.map((b, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid var(--gray-200)",
              borderRadius: 6,
              padding: 12,
              background: "var(--gray-50, #f9fafb)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color:
                    b.kind === "image"
                      ? "var(--rst-blue, #1e47a1)"
                      : b.kind === "video"
                        ? "var(--rst-red, #c8332a)"
                        : "var(--gray-600)",
                }}
              >
                {b.kind === "image"
                  ? "🖼 Image"
                  : b.kind === "video"
                    ? "▶ Vidéo YouTube"
                    : "¶ Paragraphe"}{" "}
                · #{idx + 1}
              </span>
              <div style={{ flex: 1 }} />
              <Button size="sm" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => move(idx, 1)}
                disabled={idx === blocks.length - 1}
              >
                ↓
              </Button>
              <Button size="sm" variant="dangerOutline" onClick={() => removeAt(idx)}>
                Retirer
              </Button>
            </div>

            {b.kind === "paragraph" ? (
              <Textarea
                label=""
                rows={4}
                value={b.text}
                onChange={(e) => patchAt(idx, { text: e.target.value })}
                placeholder="Texte du paragraphe…"
              />
            ) : b.kind === "video" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Input
                  label="Lien YouTube"
                  type="url"
                  value={b.url}
                  onChange={(e) => patchAt(idx, { url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=… ou https://youtu.be/…"
                />
                <Input
                  label="Légende (optionnelle)"
                  value={b.caption ?? ""}
                  onChange={(e) => patchAt(idx, { caption: e.target.value })}
                  placeholder="ex. Témoignage de la soirée"
                />
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                {b.src ? (
                  <img
                    src={b.src}
                    alt={b.alt ?? ""}
                    style={{
                      width: 200,
                      height: 130,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid var(--gray-200)",
                    }}
                  />
                ) : null}
                <div
                  style={{
                    flex: 1,
                    minWidth: 220,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <Input
                    label="Texte alternatif (alt)"
                    value={b.alt ?? ""}
                    onChange={(e) => patchAt(idx, { alt: e.target.value })}
                  />
                  <Select
                    label="Taille d'affichage"
                    value={b.size ?? "wide"}
                    onChange={(e) =>
                      patchAt(idx, { size: e.target.value as "small" | "medium" | "wide" })
                    }
                  >
                    <option value="small">Petite</option>
                    <option value="medium">Moyenne</option>
                    <option value="wide">Large (pleine largeur)</option>
                  </Select>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <input
        id={fileId}
        type="file"
        accept="image/*"
        style={HIDDEN_FILE}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void addImageFromFile(f);
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button size="sm" variant="ghost" onClick={addParagraph}>
          + Paragraphe
        </Button>
        <label
          htmlFor={fileId}
          aria-disabled={uploading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 30,
            padding: "0 12px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            cursor: uploading ? "not-allowed" : "pointer",
            background: uploading ? "var(--gray-300)" : "var(--gray-100, #f3f4f6)",
            color: "var(--ink-1, #0f1a3a)",
            border: "1px solid var(--gray-200)",
            userSelect: "none",
          }}
        >
          {uploading ? "Upload…" : "+ Image (upload)"}
        </label>
        <Button size="sm" variant="ghost" onClick={addVideo}>
          + Vidéo YouTube
        </Button>
      </div>
    </div>
  );
}

function blankTr(langue: "fr" | "en"): AnnonceTraduction {
  return {
    langue,
    titre: "",
    titre_em: "",
    sous_type_label: "",
    description: "",
    date_display: "",
    dl: "",
    content_blocks: [],
  };
}

interface DraftState {
  slug: string;
  type: Annonce["type"];
  sous_type: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  cta_url: string;
  est_phare: boolean;
  featured_eyebrow: string;
  fr: AnnonceTraduction;
  en: AnnonceTraduction;
}

function emptyDraft(): DraftState {
  return {
    slug: "",
    type: "reunion",
    sous_type: "",
    date_debut: churchNow().format("YYYY-MM-DDTHH:mm"),
    date_fin: "",
    lieu: "",
    cta_url: "",
    est_phare: false,
    featured_eyebrow: "",
    fr: blankTr("fr"),
    en: blankTr("en"),
  };
}

export function AnnonceEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { slug } = useParams<{ slug?: string }>();
  const isNew = !slug;

  const query = useQuery({
    queryKey: ["annonce", slug],
    queryFn: () => annoncesApi.get(slug as string),
    enabled: !isNew,
  });

  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [hydrated, setHydrated] = useState(isNew);

  if (query.data && !hydrated) {
    setDraft({
      slug: query.data.slug,
      type: query.data.type,
      sous_type: query.data.sous_type,
      date_debut: toChurchDateTime(query.data.date_debut),
      date_fin: query.data.date_fin ? toChurchDateTime(query.data.date_fin) : "",
      lieu: query.data.lieu,
      cta_url: query.data.cta_url,
      est_phare: query.data.est_phare,
      featured_eyebrow: query.data.featured_eyebrow,
      fr: (query.data.traductions ?? []).find((t) => t.langue === "fr") ?? blankTr("fr"),
      en: (query.data.traductions ?? []).find((t) => t.langue === "en") ?? blankTr("en"),
    });
    setHydrated(true);
  }

  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  if (query.data && editingVersion === null) {
    setEditingVersion(query.data.revision_version ?? query.data.revision?.version ?? 0);
  }
  const options = revisionOptions({ statut: "", revision_version: editingVersion ?? 0 });
  const access = useWorkflowAccess(query.data);
  const draftGuard = useDraftGuard(draft, hydrated);

  const save = useMutation({
    mutationFn: () => {
      if (!draft.fr.titre.trim())
        throw new FormValidationError({ titre: "Renseignez le titre en français." });
      if (draft.date_fin && draft.date_fin < draft.date_debut)
        throw new FormValidationError({
          date_fin: "La fin doit être après le début de l’événement.",
        });
      const payload: Partial<Annonce> = {
        slug: draft.slug || undefined,
        type: draft.type,
        sous_type: draft.sous_type,
        date_debut: churchDateTimeToISO(draft.date_debut, "date_debut"),
        date_fin: draft.date_fin ? churchDateTimeToISO(draft.date_fin, "date_fin") : null,
        lieu: draft.lieu,
        cta_url: draft.cta_url,
        est_phare: draft.est_phare,
        featured_eyebrow: draft.featured_eyebrow,
        traductions: [draft.fr, draft.en].filter((t) => t.titre || t.description),
      } as Partial<Annonce>;
      return isNew
        ? annoncesApi.create(payload)
        : annoncesApi.update(slug as string, payload, options);
    },
    onSuccess: (saved) => {
      setEditingVersion(saved.revision_version ?? saved.revision?.version ?? 0);
      draftGuard.markSaved();
      queryClient.setQueryData(["annonce", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["annonces-list"] });
      if (isNew) navigate(`/annonces/${saved.slug}`);
    },
  });

  const afficheUpload = useMutation({
    mutationFn: (file: File) => annoncesApi.uploadAffiche(slug as string, file, options),
    onSuccess: (saved) => {
      setEditingVersion(saved.revision_version ?? saved.revision?.version ?? 0);
      queryClient.setQueryData(["annonce", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["annonce", slug] });
    },
  });

  const update = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const updateTr = (langue: "fr" | "en", patch: Partial<AnnonceTraduction>) =>
    setDraft((prev) => ({ ...prev, [langue]: { ...prev[langue], ...patch } }));

  const annonce = query.data;
  const statut = annonce?.statut as StatutWorkflow | undefined;

  const soumettre = useMutation({
    mutationFn: () => annoncesApi.soumettre(slug as string, options),
    onSuccess: (saved) => {
      setEditingVersion(saved.revision_version ?? saved.revision?.version ?? 0);
      return queryClient.setQueryData(["annonce", saved.slug], saved);
    },
  });
  const publier = useMutation({
    mutationFn: () => annoncesApi.publier(slug as string, options),
    onSuccess: (saved) => {
      setEditingVersion(saved.revision_version ?? saved.revision?.version ?? 0);
      queryClient.setQueryData(["annonce", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["annonces-list"] });
    },
  });
  const rejeter = useMutation({
    mutationFn: () => annoncesApi.rejeter(slug as string, options),
    onSuccess: (saved) => {
      setEditingVersion(saved.revision_version ?? saved.revision?.version ?? 0);
      return queryClient.setQueryData(["annonce", saved.slug], saved);
    },
  });
  const archiver = useMutation({
    mutationFn: () => annoncesApi.archiver(slug as string, options),
    onSuccess: (saved) => {
      setEditingVersion(saved.revision_version ?? saved.revision?.version ?? 0);
      queryClient.setQueryData(["annonce", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["annonces-list"] });
    },
  });
  const wfPending =
    soumettre.isPending || publier.isPending || rejeter.isPending || archiver.isPending;

  const operationError =
    save.error ||
    soumettre.error ||
    publier.error ||
    rejeter.error ||
    archiver.error ||
    afficheUpload.error;
  const live = hasLivePublication(annonce);
  const busy = wfPending || save.isPending || afficheUpload.isPending;
  if (!isNew && !query.data)
    return (
      <>
        <Breadcrumb items={[{ label: "Retour à la liste", to: "/annonces" }, { label: "Fiche" }]} />
        <PageHead title="Chargement de la fiche" />
        <PageBody>
          <QueryFeedback
            loading={query.isLoading}
            error={query.error}
            retry={() => void query.refetch()}
          />
        </PageBody>
      </>
    );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Annonces", to: "/annonces" },
          { label: isNew ? "Nouvelle" : (annonce?.traductions?.[0]?.titre ?? "Édition") },
        ]}
      />
      <PageHead
        title={isNew ? "Nouvelle annonce" : (annonce?.traductions?.[0]?.titre ?? "Édition")}
        actions={
          <div className={common.actions}>
            {annonce ? <StatusBadge statut={annonce.statut as StatutWorkflow} /> : null}
            <Button variant="primary" onClick={() => save.mutate()} disabled={busy}>
              Enregistrer
            </Button>
            {!isNew && ["brouillon", "rejete"].includes(statut ?? "") && !access.validator ? (
              <Button
                variant="ghost"
                onClick={() => soumettre.mutate()}
                disabled={busy || draftGuard.dirty}
              >
                Soumettre à validation
              </Button>
            ) : null}
            {!isNew &&
            ["brouillon", "en_revue", "rejete"].includes(statut ?? "") &&
            access.validator ? (
              <Button
                variant="success"
                onClick={() => {
                  if (window.confirm("Publier le contenu enregistré sur la vitrine ?"))
                    publier.mutate();
                }}
                disabled={busy || draftGuard.dirty || !access.canValidate}
              >
                {publier.isPending ? "Publication…" : live ? "Publier la correction" : "Publier"}
              </Button>
            ) : null}
            {!isNew && statut === "en_revue" ? (
              <Button
                variant="dangerOutline"
                onClick={() => rejeter.mutate()}
                disabled={busy || draftGuard.dirty || !access.canValidate}
              >
                Rejeter
              </Button>
            ) : null}
            {!isNew && live ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Archiver ce contenu et le retirer de la vitrine ?"))
                    archiver.mutate();
                }}
                disabled={busy || draftGuard.dirty || !access.canManage}
              >
                Archiver
              </Button>
            ) : null}
          </div>
        }
      />
      <PageBody>
        <div className={common.editor}>
          <ActionError error={operationError} />
          <DiscardRevision
            item={annonce}
            endpoint={`/annonces/admin/${slug}/`}
            listPath="/annonces"
            busy={busy}
            version={editingVersion ?? 0}
          />
          <p className={common.notice} role="status">
            {publicationNotice(annonce, draftGuard.dirty, save.isSuccess)}
          </p>
          {!isNew &&
            (!access.validator ? (
              <p className={common.notice}>La publication est réservée aux validateurs.</p>
            ) : (
              <div className={common.notice}>
                {access.requiresOtherReviewer && (
                  <p>
                    La validation doit être effectuée par une autre personne que l’auteur ou le
                    dernier éditeur.
                  </p>
                )}
                {!access.recent && <IdentityCheck />}
              </div>
            ))}
          <fieldset disabled={busy} className={common.editor}>
            <section className={common.section}>
              <span className={common.sectionTitle}>Informations générales</span>
              <div className={common.formGrid}>
                <Select
                  label="Type"
                  value={draft.type}
                  onChange={(event) => update("type", event.target.value as Annonce["type"])}
                >
                  <option value="reunion">Réunion</option>
                  <option value="voyage">Voyage</option>
                  <option value="sortie">Sortie</option>
                  <option value="exceptionnelle">Exceptionnelle</option>
                </Select>
                <Input
                  label="Sous-type"
                  value={draft.sous_type}
                  onChange={(event) => update("sous_type", event.target.value)}
                />
                <div className={common.full}>
                  <DateTimeField
                    label="Date de début"
                    value={draft.date_debut}
                    required
                    onChange={(value) => update("date_debut", value)}
                  />
                </div>
                <div className={common.full}>
                  <DateTimeField
                    label="Date de fin (facultative)"
                    value={draft.date_fin}
                    onChange={(value) => update("date_fin", value)}
                  />
                </div>
                <Input
                  label="Lieu"
                  value={draft.lieu}
                  onChange={(event) => update("lieu", event.target.value)}
                />
                <Input
                  label="Lien du bouton (facultatif)"
                  type="url"
                  value={draft.cta_url}
                  onChange={(event) => update("cta_url", event.target.value)}
                />
                <div>
                  <Toggle
                    checked={draft.est_phare}
                    onChange={(next) => update("est_phare", next)}
                    label="Annonce phare (mise en avant)"
                  />
                </div>
                <Input
                  label="Surtitre de l’annonce mise en avant"
                  value={draft.featured_eyebrow}
                  onChange={(event) => update("featured_eyebrow", event.target.value)}
                />
              </div>
            </section>

            <section className={common.section}>
              <span className={common.sectionTitle}>Contenu rédactionnel</span>
              <Tabs
                readOnly={false}
                items={(["fr", "en"] as const).map((langue) => ({
                  value: langue,
                  label: langue === "fr" ? "Français" : "English",
                  content: (
                    <div className={common.formGrid}>
                      <Input
                        label="Titre"
                        value={draft[langue].titre}
                        onChange={(event) => updateTr(langue, { titre: event.target.value })}
                      />
                      <Input
                        label="Partie italique"
                        value={draft[langue].titre_em}
                        onChange={(event) => updateTr(langue, { titre_em: event.target.value })}
                      />
                      <Input
                        label="Sous-type label"
                        value={draft[langue].sous_type_label}
                        onChange={(event) =>
                          updateTr(langue, { sous_type_label: event.target.value })
                        }
                      />
                      <Input
                        label="Date display"
                        value={draft[langue].date_display}
                        onChange={(event) => updateTr(langue, { date_display: event.target.value })}
                      />
                      <div className={common.full}>
                        <Textarea
                          label="Description"
                          rows={5}
                          value={draft[langue].description}
                          onChange={(event) =>
                            updateTr(langue, { description: event.target.value })
                          }
                        />
                      </div>
                      <Input
                        label="DL court (ex: VEN. MAI)"
                        value={draft[langue].dl}
                        onChange={(event) => updateTr(langue, { dl: event.target.value })}
                      />
                    </div>
                  ),
                }))}
              />
            </section>

            {!isNew && annonce ? (
              <section className={common.section}>
                <span className={common.sectionTitle}>Affiche (événement à venir)</span>
                <p className={common.notice}>
                  L'affiche officielle s'affiche en grand pour les annonces à venir. Toutes les
                  annonces n'en ont pas — c'est optionnel.
                </p>
                <div
                  style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}
                >
                  {annonce.affiche ? (
                    <img
                      src={annonce.affiche}
                      alt="Affiche de l'annonce"
                      style={{
                        width: 220,
                        maxHeight: 300,
                        objectFit: "contain",
                        borderRadius: 6,
                        border: "1px solid var(--gray-200)",
                        background: "var(--gray-50)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 220,
                        height: 280,
                        display: "grid",
                        placeItems: "center",
                        background: "var(--gray-50, #f7f7f7)",
                        border: "1px dashed var(--gray-300)",
                        borderRadius: 6,
                        color: "var(--gray-500)",
                        fontSize: 13,
                        textAlign: "center",
                        padding: 12,
                      }}
                    >
                      Aucune affiche
                    </div>
                  )}
                  <div>
                    <input
                      id="annonce-affiche-input"
                      type="file"
                      accept="image/*"
                      style={HIDDEN_FILE}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) afficheUpload.mutate(f);
                      }}
                    />
                    <label
                      htmlFor="annonce-affiche-input"
                      aria-disabled={afficheUpload.isPending}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: 36,
                        padding: "0 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 6,
                        cursor: afficheUpload.isPending ? "not-allowed" : "pointer",
                        background: afficheUpload.isPending
                          ? "var(--gray-300)"
                          : "var(--rst-blue, #1e47a1)",
                        color: "white",
                        userSelect: "none",
                      }}
                    >
                      {afficheUpload.isPending
                        ? "Upload…"
                        : annonce.affiche
                          ? "Remplacer l'affiche"
                          : "Téléverser une affiche"}
                    </label>
                  </div>
                </div>
              </section>
            ) : null}

            <section className={common.section}>
              <span className={common.sectionTitle}>Compte-rendu (après l'événement)</span>
              <p className={common.notice}>
                Une fois l'événement passé, rédige ici le compte-rendu : des paragraphes et des
                photos intercalées. C'est ce bloc qui s'affiche sur la fiche de l'annonce passée
                côté vitrine.
                {isNew ? " Tu pourras ajouter des images après avoir créé l'annonce." : ""}
              </p>
              <ContentBlocksEditor
                blocks={draft.fr.content_blocks}
                onChange={(next) => updateTr("fr", { content_blocks: next })}
              />
            </section>
          </fieldset>
          <SaveFooter onSave={() => save.mutate()} pending={busy} disabled={false} />
        </div>
      </PageBody>
    </>
  );
}

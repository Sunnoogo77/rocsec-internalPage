import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Input, Select, StatusBadge, Tabs, Textarea, Toggle } from "@/components/ui";
import { temoignagesApi } from "@/api";
import { HttpError } from "@/api/client";
import type { Temoignage, TemoignageTraduction } from "@/types";
import common from "../common.module.css";

function blankTraduction(langue: "fr" | "en"): TemoignageTraduction {
  return {
    langue,
    auteur: "",
    cite: "",
    quote_text: "",
    eyebrow: "",
    titre: "",
    corps: "",
    paragraphs: [],
    byline: "",
    reading_minutes: null,
    tag: "",
    verset_ref: "",
    verset_text: "",
  };
}

interface DraftState {
  type: Temoignage["type"];
  has_detail: boolean;
  accent_rouge: boolean;
  source: Temoignage["source"];
  image_publique: boolean;
  email_contact: string;
  telephone_contact: string;
  ville_contact: string;
  fr: TemoignageTraduction;
  en: TemoignageTraduction;
}

function emptyDraft(): DraftState {
  return {
    type: "recit",
    has_detail: false,
    accent_rouge: false,
    source: "admin",
    image_publique: true,
    email_contact: "",
    telephone_contact: "",
    ville_contact: "",
    fr: blankTraduction("fr"),
    en: blankTraduction("en"),
  };
}

export function TemoignageEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { slug } = useParams<{ slug: string }>();
  // Mode "nouveau" : path `/temoignages/nouveau` (sans slug capturé puisque
  // la route est définie statiquement). On vérifie l'URL pour être sûr.
  const isNew = !slug || location.pathname.endsWith("/temoignages/nouveau");
  const [motifRejet, setMotifRejet] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const query = useQuery({
    queryKey: ["temoignage", slug],
    queryFn: () => temoignagesApi.get(slug as string),
    enabled: !isNew && Boolean(slug),
  });

  const [draft, setDraft] = useState<DraftState | null>(isNew ? emptyDraft() : null);

  if (!isNew && query.data && draft === null) {
    setDraft({
      type: query.data.type,
      has_detail: query.data.has_detail,
      accent_rouge: query.data.accent_rouge,
      source: query.data.source,
      image_publique: query.data.image_publique ?? true,
      email_contact: query.data.email_contact,
      telephone_contact: query.data.telephone_contact ?? "",
      ville_contact: query.data.ville_contact ?? "",
      fr:
        (query.data.traductions ?? []).find((t) => t.langue === "fr") ?? blankTraduction("fr"),
      en:
        (query.data.traductions ?? []).find((t) => t.langue === "en") ?? blankTraduction("en"),
    });
  }

  // saveMutation : POST si création, PATCH sinon. Sur création, on redirige
  // vers la fiche pour permettre d'attacher une image.
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("État local manquant");
      const body: Partial<Temoignage> = {
        type: d.type,
        has_detail: d.has_detail,
        accent_rouge: d.accent_rouge,
        source: d.source,
        image_publique: d.image_publique,
        email_contact: d.email_contact,
        telephone_contact: d.telephone_contact,
        ville_contact: d.ville_contact,
        traductions: [d.fr, d.en].filter(
          (t) => t.auteur || t.titre || t.corps || t.quote_text,
        ),
      };
      return isNew ? temoignagesApi.create(body) : temoignagesApi.update(slug as string, body);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["temoignage", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["temoignages"] });
      if (isNew) navigate(`/temoignages/${saved.slug}`);
    },
  });

  const imageUploadMutation = useMutation({
    mutationFn: (file: File) => temoignagesApi.uploadImage(slug as string, file),
    onSuccess: (saved) => {
      queryClient.setQueryData(["temoignage", saved.slug], saved);
    },
  });

  const saveError = saveMutation.error instanceof HttpError ? saveMutation.error : null;

  const approuver = useMutation({
    mutationFn: () => temoignagesApi.approuver(slug as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["temoignage", slug] }),
  });

  const rejeter = useMutation({
    mutationFn: () => temoignagesApi.rejeter(slug as string, motifRejet),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["temoignage", slug] }),
  });

  const enRevue = useMutation({
    mutationFn: () => temoignagesApi.marquerEnRevue(slug as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["temoignage", slug] }),
  });

  // En mode edit, on attend que la query ait remonté et que draft soit hydraté.
  if (!isNew && (!query.data || !draft)) {
    return null;
  }
  if (isNew && !draft) {
    return null;
  }

  // À ce stade `draft` est garanti non-null par les guards ci-dessus.
  // L'assertion explicite permet à TS de narrower dans tout le JSX.
  const d = draft as DraftState;
  const t = query.data ?? null;
  const updateField = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const updateTr = (langue: "fr" | "en", patch: Partial<TemoignageTraduction>) =>
    setDraft((prev) =>
      prev ? { ...prev, [langue]: { ...prev[langue], ...patch } } : prev,
    );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Témoignages", to: "/temoignages" },
          { label: isNew ? "Nouveau" : (d.fr.auteur || t?.slug || "Édition") },
        ]}
      />
      <PageHead
        title={
          isNew
            ? "Nouveau témoignage"
            : `Examen du témoignage de ${d.fr.auteur || "(anonyme)"}`
        }
        lede={
          isNew
            ? "Saisissez un témoignage transmis hors-ligne (à l'église, par téléphone, etc.). " +
              "L'image principale et les photos s'ajoutent après la création initiale."
            : `Reçu ${t ? dayjs(t.date_recue).format("LL") : ""} · source ${
                t?.source === "soumission_publique" ? "publique" : "admin"
              }`
        }
        actions={
          <div className={common.actions}>
            {t && <StatusBadge statut={t.statut} />}
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement…" : (isNew ? "Créer" : "Enregistrer")}
            </Button>
            {t && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => window.open(temoignagesApi.printUrl(t.slug), "_blank", "noopener")}
                  title="Ouvre une fenêtre d'impression — choisir « Enregistrer en PDF »"
                >
                  Exporter en PDF
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => window.open(temoignagesApi.bundleUrl(t.slug), "_blank", "noopener")}
                  title="Télécharge un ZIP (texte + photos) prêt à partager via WhatsApp"
                >
                  Bundle WhatsApp
                </Button>
                {t.statut !== "publie" ? (
                  <Button variant="success" onClick={() => approuver.mutate()}>
                    Approuver et publier
                  </Button>
                ) : null}
              </>
            )}
            <Button variant="ghost" onClick={() => navigate("/temoignages")}>
              Retour
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className={common.editor}>
          {t && t.source === "soumission_publique" && (
            <section className={common.section}>
              <span className={common.sectionTitle}>§0 Soumission publique</span>
              <div className={common.formGrid}>
                <Input
                  label="Prénom (saisi par le témoin)"
                  value={t.prenom_contact}
                  readOnly
                />
                <Input
                  label="Nom (saisi par le témoin)"
                  value={t.nom_contact}
                  readOnly
                />
                <Input
                  label="Téléphone"
                  value={d.telephone_contact}
                  onChange={(event) => updateField("telephone_contact", event.target.value)}
                />
                <Input
                  label="Ville"
                  value={d.ville_contact}
                  onChange={(event) => updateField("ville_contact", event.target.value)}
                />
              </div>
              {t.texte_soumis && (
                <div style={{ marginTop: 12 }}>
                  <span className={common.sectionTitle} style={{ fontSize: 12, opacity: 0.7 }}>
                    Texte brut soumis
                  </span>
                  <pre style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-serif, Georgia, serif",
                    fontSize: 14,
                    lineHeight: 1.55,
                    background: "var(--gray-50, #f7f7f7)",
                    padding: 12,
                    borderRadius: 4,
                    margin: 0,
                    border: "1px solid var(--gray-200, #e5e7eb)",
                  }}>
                    {t.texte_soumis}
                  </pre>
                </div>
              )}
              {t.photos && t.photos.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <span className={common.sectionTitle} style={{ fontSize: 12, opacity: 0.7 }}>
                    Photos jointes ({t.photos.length})
                  </span>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 10,
                    marginTop: 8,
                  }}>
                    {t.photos.map((p) => (
                      <a key={p.id} href={p.image_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={p.image_url}
                          alt={p.legende || "Photo soumise"}
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            objectFit: "cover",
                            borderRadius: 4,
                            border: "1px solid var(--gray-200, #e5e7eb)",
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {saveError && (
            <div className={common.errorBox} role="alert">
              <strong>Le serveur a refusé l'enregistrement :</strong> {saveError.message}
            </div>
          )}

          <section className={common.section}>
            <span className={common.sectionTitle}>§1 Métadonnées</span>
            <div className={common.formGrid}>
              <Select
                label="Type"
                value={d.type}
                onChange={(event) => updateField("type", event.target.value as Temoignage["type"])}
                help="Citation = box courte. Illustré = carte avec image. Récit = bloc texte long."
              >
                <option value="citation">Citation</option>
                <option value="illustre">Illustré</option>
                <option value="recit">Récit</option>
              </Select>
              <Select
                label="Source"
                value={d.source}
                onChange={(event) => updateField("source", event.target.value as Temoignage["source"])}
                help="« Admin » = saisi en interne ; « Soumission publique » = via formulaire vitrine."
              >
                <option value="admin">Saisi en interne</option>
                <option value="soumission_publique">Soumission publique</option>
              </Select>
              <Input
                label="Email contact (optionnel)"
                type="email"
                value={d.email_contact}
                onChange={(event) => updateField("email_contact", event.target.value)}
              />
              <Input
                label="Téléphone (optionnel)"
                value={d.telephone_contact}
                onChange={(event) => updateField("telephone_contact", event.target.value)}
              />
              <Input
                label="Ville (optionnel)"
                value={d.ville_contact}
                onChange={(event) => updateField("ville_contact", event.target.value)}
              />
            </div>
          </section>

          {!isNew && t && (
            <section className={common.section}>
              <span className={common.sectionTitle}>§1bis Image principale</span>
              <p style={{ fontSize: 13, color: "var(--gray-600)", margin: "0 0 12px" }}>
                Image éditoriale affichée en grand sur la mosaïque (emplacements illustrés)
                et le modal de lecture. Distincte des photos jointes par le témoin lors de
                la soumission publique.
              </p>
              <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                {t.image ? (
                  <img
                    src={t.image}
                    alt="Image principale du témoignage"
                    style={{
                      width: 240,
                      height: 180,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid var(--gray-200)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 240,
                      height: 180,
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
                    Aucune image — uploadez-en une
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) imageUploadMutation.mutate(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploadMutation.isPending}
                  >
                    {imageUploadMutation.isPending
                      ? "Upload…"
                      : t.image ? "Remplacer l'image" : "Uploader une image"}
                  </Button>
                  <Toggle
                    checked={d.image_publique}
                    onChange={(v) => {
                      updateField("image_publique", v);
                      // Persiste tout de suite (toggle, pas de bouton dédié).
                      void temoignagesApi.update(slug as string, { image_publique: v });
                    }}
                    label="Image et photos visibles sur la vitrine"
                  />
                  <small style={{ fontSize: 12, color: "var(--gray-500)" }}>
                    Si décoché, le texte reste publié mais l'image et les photos jointes
                    sont masquées côté vitrine.
                  </small>
                </div>
              </div>
            </section>
          )}

          <section className={common.section}>
            <span className={common.sectionTitle}>§2 Contenu rédactionnel</span>
            <Tabs
              items={[
                {
                  value: "fr",
                  label: "Français",
                  content: (
                    <div className={common.formGrid}>
                      <Input
                        label="Auteur"
                        value={d.fr.auteur}
                        onChange={(event) => updateTr("fr", { auteur: event.target.value })}
                      />
                      <Input
                        label="Cite (attribution)"
                        value={d.fr.cite}
                        onChange={(event) => updateTr("fr", { cite: event.target.value })}
                      />
                      <div className={common.full}>
                        <Textarea
                          label="Citation courte"
                          rows={3}
                          value={d.fr.quote_text}
                          onChange={(event) =>
                            updateTr("fr", { quote_text: event.target.value })
                          }
                        />
                      </div>
                      <Input
                        label="Eyebrow"
                        value={d.fr.eyebrow}
                        onChange={(event) => updateTr("fr", { eyebrow: event.target.value })}
                      />
                      <Input
                        label="Titre"
                        value={d.fr.titre}
                        onChange={(event) => updateTr("fr", { titre: event.target.value })}
                      />
                      <div className={common.full}>
                        <Textarea
                          label="Corps"
                          rows={6}
                          value={d.fr.corps}
                          onChange={(event) => updateTr("fr", { corps: event.target.value })}
                        />
                      </div>
                      <Input
                        label="Verset (référence)"
                        value={d.fr.verset_ref}
                        onChange={(event) =>
                          updateTr("fr", { verset_ref: event.target.value })
                        }
                      />
                      <Input
                        label="Verset (texte)"
                        value={d.fr.verset_text}
                        onChange={(event) =>
                          updateTr("fr", { verset_text: event.target.value })
                        }
                      />
                    </div>
                  ),
                },
                {
                  value: "en",
                  label: "English",
                  content: (
                    <div className={common.formGrid}>
                      <Input
                        label="Author"
                        value={d.en.auteur}
                        onChange={(event) => updateTr("en", { auteur: event.target.value })}
                      />
                      <Input
                        label="Title"
                        value={d.en.titre}
                        onChange={(event) => updateTr("en", { titre: event.target.value })}
                      />
                      <div className={common.full}>
                        <Textarea
                          label="Body"
                          rows={6}
                          value={d.en.corps}
                          onChange={(event) => updateTr("en", { corps: event.target.value })}
                        />
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </section>

          <section className={common.section}>
            <span className={common.sectionTitle}>§3 Décision</span>
            <div className={common.row}>
              <Button variant="success" onClick={() => approuver.mutate()}>
                Approuver et publier
              </Button>
              <Button variant="ghost" onClick={() => enRevue.mutate()}>
                Marquer en revue
              </Button>
            </div>
            <Textarea
              label="Motif (si rejet)"
              rows={3}
              value={motifRejet}
              onChange={(event) => setMotifRejet(event.target.value)}
            />
            <Button
              variant="dangerOutline"
              onClick={() => rejeter.mutate()}
              disabled={!motifRejet.trim()}
            >
              Rejeter avec motif
            </Button>
          </section>
        </div>
      </PageBody>
    </>
  );
}

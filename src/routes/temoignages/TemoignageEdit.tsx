import { ActionError } from "@/components/ui/ActionError";
import { SaveFooter } from "@/components/forms/SaveFooter";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Input, Select, StatusBadge, Tabs, Textarea, Toggle, Modal } from "@/components/ui";
import { temoignagesApi } from "@/api";

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
  const [dirty, setDirty] = useState(false);
  const [decision, setDecision] = useState<"publish" | "reject" | null>(null);
  useUnsavedChanges(dirty);
  const [motifRejet, setMotifRejet] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const query = useQuery({
    queryKey: ["temoignage", slug],
    queryFn: () => temoignagesApi.get(slug as string),
    enabled: !isNew && Boolean(slug),
  });

  const access = useWorkflowAccess(query.data);
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
      fr: (query.data.traductions ?? []).find((t) => t.langue === "fr") ?? blankTraduction("fr"),
      en: (query.data.traductions ?? []).find((t) => t.langue === "en") ?? blankTraduction("en"),
    });
  }

  // saveMutation : POST si création, PATCH sinon. Sur création, on redirige
  // vers la fiche pour permettre d'attacher une image.
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("État local manquant");
      if (!draft.fr.auteur.trim() || !(draft.fr.corps.trim() || draft.fr.quote_text.trim()))
        throw new Error("Renseignez le nom affiché et le texte du témoignage en français.");
      const body: Partial<Temoignage> = {
        type: d.type,
        has_detail: d.has_detail,
        accent_rouge: d.accent_rouge,
        source: d.source,
        image_publique: d.image_publique,
        email_contact: d.email_contact,
        telephone_contact: d.telephone_contact,
        ville_contact: d.ville_contact,
        traductions: [d.fr, d.en].filter((t) => t.auteur || t.titre || t.corps || t.quote_text),
      };
      return isNew ? temoignagesApi.create(body) : temoignagesApi.update(slug as string, body);
    },
    onSuccess: (saved) => {
      setDirty(false);
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

  const saveError = saveMutation.error instanceof Error ? saveMutation.error : null;

  const approuver = useMutation({
    mutationFn: () => temoignagesApi.approuver(slug as string),
    onSuccess: () => {
      setDecision(null);
      void queryClient.invalidateQueries({ queryKey: ["temoignage", slug] });
      void queryClient.invalidateQueries({ queryKey: ["temoignages"] });
    },
  });

  const rejeter = useMutation({
    mutationFn: () => temoignagesApi.rejeter(slug as string, motifRejet),
    onSuccess: () => {
      setDecision(null);
      void queryClient.invalidateQueries({ queryKey: ["temoignage", slug] });
      void queryClient.invalidateQueries({ queryKey: ["temoignages"] });
    },
  });

  const enRevue = useMutation({
    mutationFn: () => temoignagesApi.marquerEnRevue(slug as string),
    onSuccess: () => {
      setDecision(null);
      void queryClient.invalidateQueries({ queryKey: ["temoignage", slug] });
      void queryClient.invalidateQueries({ queryKey: ["temoignages"] });
    },
  });

  // En mode edit, on attend que la query ait remonté et que draft soit hydraté.
  if (!isNew && (!query.data || !draft)) {
    return (
      <>
        <Breadcrumb items={[{ label: "Témoignages", to: "/temoignages" }, { label: "Fiche" }]} />
        <PageHead title="Témoignage" />
        <PageBody>
          <QueryFeedback
            loading={query.isLoading}
            error={query.error}
            retry={() => void query.refetch()}
          />
        </PageBody>
      </>
    );
  }
  if (isNew && !draft) {
    return null;
  }

  // À ce stade `draft` est garanti non-null par les guards ci-dessus.
  // L'assertion explicite permet à TS de narrower dans tout le JSX.
  const d = draft as DraftState;
  const t = query.data ?? null;
  const published = t?.statut === "publie";
  const busy =
    saveMutation.isPending ||
    imageUploadMutation.isPending ||
    approuver.isPending ||
    rejeter.isPending ||
    enRevue.isPending;
  const actionError =
    approuver.error || rejeter.error || enRevue.error || imageUploadMutation.error;
  const updateField = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDirty(true);
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  const updateTr = (langue: "fr" | "en", patch: Partial<TemoignageTraduction>) => {
    setDirty(true);
    setDraft((prev) => (prev ? { ...prev, [langue]: { ...prev[langue], ...patch } } : prev));
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Témoignages", to: "/temoignages" },
          { label: isNew ? "Nouveau" : d.fr.auteur || t?.slug || "Édition" },
        ]}
      />
      <PageHead
        title={
          isNew ? "Nouveau témoignage" : `Examen du témoignage de ${d.fr.auteur || "(anonyme)"}`
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
            <Button
              variant="primary"
              onClick={() => saveMutation.mutate()}
              disabled={busy || published}
            >
              {saveMutation.isPending ? "Enregistrement…" : isNew ? "Créer" : "Enregistrer"}
            </Button>
            {t && access.canManage && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => window.open(temoignagesApi.printUrl(t.slug), "_blank", "noopener")}
                  title="Ouvre une fenêtre d'impression — choisir « Enregistrer en PDF »"
                >
                  Version imprimable
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    window.open(temoignagesApi.bundleUrl(t.slug), "_blank", "noopener")
                  }
                  title="Télécharge un ZIP (texte + photos) du témoignage"
                >
                  Télécharger texte et photos
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                if (!dirty || window.confirm("Quitter sans enregistrer vos modifications ?"))
                  navigate("/temoignages");
              }}
            >
              Retour
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className={common.editor}>
          {published ? (
            <p className={common.notice}>
              Ce témoignage est publié. La fiche est en lecture seule.
            </p>
          ) : (
            <p role="status" className={common.notice}>
              {dirty
                ? "Modifications non enregistrées. Enregistrez avant de poursuivre la relecture."
                : saveMutation.isSuccess
                  ? "Modifications enregistrées."
                  : "Préparez le texte, enregistrez vos modifications, puis passez à la relecture."}
            </p>
          )}
          <ActionError error={actionError} />
          {t?.motif_rejet && (
            <p className={common.notice}>
              <strong>Motif de la décision :</strong> {t.motif_rejet}
            </p>
          )}
          <fieldset disabled={published || busy} className={common.editor}>
            {t && t.source === "soumission_publique" && (
              <section className={common.section}>
                <span className={common.sectionTitle}>Message reçu · original conservé</span>
                <div className={common.formGrid}>
                  <Input label="Prénom (saisi par le témoin)" value={t.prenom_contact} readOnly />
                  <Input label="Nom (saisi par le témoin)" value={t.nom_contact} readOnly />
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
                      Texte reçu
                    </span>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: 14,
                        lineHeight: 1.55,
                        background: "var(--gray-50, #f7f7f7)",
                        padding: 12,
                        borderRadius: 4,
                        margin: 0,
                        border: "1px solid var(--gray-200, #e5e7eb)",
                      }}
                    >
                      {t.texte_soumis}
                    </pre>
                  </div>
                )}
                {t.photos && t.photos.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <span className={common.sectionTitle} style={{ fontSize: 12, opacity: 0.7 }}>
                      Photos jointes ({t.photos.length})
                    </span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: 10,
                        marginTop: 8,
                      }}
                    >
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
              <span className={common.sectionTitle}>Présentation et contact</span>
              <div className={common.formGrid}>
                <Select
                  label="Type"
                  value={d.type}
                  onChange={(event) =>
                    updateField("type", event.target.value as Temoignage["type"])
                  }
                  help="Citation = box courte. Illustré = carte avec image. Récit = bloc texte long."
                >
                  <option value="citation">Citation</option>
                  <option value="illustre">Illustré</option>
                  <option value="recit">Récit</option>
                </Select>
                <Select
                  label="Source"
                  value={d.source}
                  onChange={(event) =>
                    updateField("source", event.target.value as Temoignage["source"])
                  }
                  help="« Admin » = saisi en interne ; « Soumission publique » = via formulaire vitrine."
                >
                  <option value="admin">Saisi en interne</option>
                  <option value="soumission_publique">Soumission publique</option>
                </Select>
                <Input
                  label="Email de contact (privé, facultatif)"
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
                <span className={common.sectionTitle}>Image principale</span>
                <p style={{ fontSize: 13, color: "var(--gray-600)", margin: "0 0 12px" }}>
                  Image éditoriale affichée en grand sur la mosaïque (emplacements illustrés) et le
                  modal de lecture. Distincte des photos jointes par le témoin lors de la soumission
                  publique.
                </p>
                <div
                  style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}
                >
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
                      Aucune image principale
                    </div>
                  )}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 220,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
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
                      disabled={busy || dirty || published}
                    >
                      {imageUploadMutation.isPending
                        ? "Envoi…"
                        : t.image
                          ? "Remplacer l'image"
                          : "Ajouter une image"}
                    </Button>
                    <Toggle
                      checked={d.image_publique}
                      onChange={(v) => {
                        updateField("image_publique", v);
                      }}
                      label="Image et photos visibles sur la vitrine"
                    />
                    <small style={{ fontSize: 12, color: "var(--gray-500)" }}>
                      Si décoché, le texte reste publié mais l'image et les photos jointes sont
                      masquées côté vitrine.
                    </small>
                  </div>
                </div>
              </section>
            )}

            <section className={common.section}>
              <span className={common.sectionTitle}>Texte à publier</span>
              <Tabs
                readOnly={published}
                items={[
                  {
                    value: "fr",
                    label: "Français",
                    content: (
                      <div className={common.formGrid}>
                        <Input
                          label="Nom affiché"
                          value={d.fr.auteur}
                          onChange={(event) => updateTr("fr", { auteur: event.target.value })}
                        />
                        <Input
                          label="Attribution (facultatif)"
                          value={d.fr.cite}
                          onChange={(event) => updateTr("fr", { cite: event.target.value })}
                        />
                        <div className={common.full}>
                          <Textarea
                            label="Citation courte"
                            rows={3}
                            value={d.fr.quote_text}
                            onChange={(event) => updateTr("fr", { quote_text: event.target.value })}
                          />
                        </div>
                        <Input
                          label="Surtitre (facultatif)"
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
                            label="Texte du témoignage"
                            rows={6}
                            value={d.fr.corps}
                            onChange={(event) => updateTr("fr", { corps: event.target.value })}
                          />
                        </div>
                        <Input
                          label="Verset (référence)"
                          value={d.fr.verset_ref}
                          onChange={(event) => updateTr("fr", { verset_ref: event.target.value })}
                        />
                        <Input
                          label="Verset (texte)"
                          value={d.fr.verset_text}
                          onChange={(event) => updateTr("fr", { verset_text: event.target.value })}
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
          </fieldset>
          {t && !published && (
            <section className={common.section} aria-labelledby="decision-title">
              <h2 id="decision-title" className={common.sectionTitle}>
                Relecture et décision
              </h2>
              {dirty && (
                <p className={common.notice}>
                  Enregistrez d’abord vos modifications. L’enregistrement remet le témoignage à
                  l’état « Reçu ».
                </p>
              )}
              {t.statut === "recu" && (
                <Button
                  variant="secondary"
                  disabled={busy || dirty}
                  onClick={() => enRevue.mutate()}
                >
                  Passer en relecture
                </Button>
              )}
              {!access.validator ? (
                <p>La publication et le refus sont réservés aux validateurs.</p>
              ) : access.requiresOtherReviewer ? (
                <p>
                  Un autre validateur doit relire ce témoignage : vous en êtes l’auteur ou la
                  dernière personne à l’avoir modifié.
                </p>
              ) : !access.recent ? (
                <div className={common.row}>
                  <p>Confirmez votre identité avant de prendre une décision.</p>
                  <IdentityCheck />
                </div>
              ) : null}
              {(t.statut === "recu" || t.statut === "en_revue") && (
                <div className={common.row}>
                  <Button
                    variant="primary"
                    disabled={!access.canValidate || busy || dirty}
                    onClick={() => setDecision("publish")}
                  >
                    Approuver et publier
                  </Button>
                  <Button
                    variant="dangerOutline"
                    disabled={!access.canValidate || busy || dirty || t.statut !== "en_revue"}
                    onClick={() => setDecision("reject")}
                  >
                    Ne pas retenir
                  </Button>
                </div>
              )}
              {t.statut === "rejete" && (
                <p>Pour préparer une nouvelle relecture, modifiez puis enregistrez le texte.</p>
              )}
            </section>
          )}
          <Modal
            open={decision !== null}
            onClose={() => {
              if (!busy) setDecision(null);
            }}
            title={
              decision === "publish" ? "Publier ce témoignage ?" : "Ne pas retenir ce témoignage ?"
            }
            footer={
              <>
                <Button variant="ghost" disabled={busy} onClick={() => setDecision(null)}>
                  Annuler
                </Button>
                <Button
                  variant={decision === "publish" ? "primary" : "danger"}
                  disabled={
                    busy ||
                    !access.canValidate ||
                    dirty ||
                    (decision === "reject" && !motifRejet.trim())
                  }
                  onClick={() => (decision === "publish" ? approuver.mutate() : rejeter.mutate())}
                >
                  {busy
                    ? "En cours…"
                    : decision === "publish"
                      ? "Confirmer la publication"
                      : "Confirmer la décision"}
                </Button>
              </>
            }
          >
            {decision === "publish" ? (
              <p>
                Le texte enregistré sera visible sur la vitrine. Vérifiez le nom affiché, le contenu
                et la visibilité des photos avant de confirmer.
              </p>
            ) : (
              <Textarea
                label="Motif de la décision"
                required
                rows={4}
                value={motifRejet}
                onChange={(e) => setMotifRejet(e.target.value)}
              />
            )}
            <ActionError error={actionError} />
          </Modal>
          <SaveFooter onSave={() => saveMutation.mutate()} pending={busy} disabled={published} />
        </div>
      </PageBody>
    </>
  );
}

import { SaveFooter } from "@/components/forms/SaveFooter";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { useDraftGuard } from "@/lib/useDraftGuard";
import { PersonneSinglePicker } from "@/components/forms/PersonneSinglePicker";
import { usePeople, isPreacher } from "@/lib/people";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Input, Select, StatusBadge, Tabs, Textarea } from "@/components/ui";
import { sermonsApi, seriesApi, typesCulteApi } from "@/api";
import type {
  CitationBranham,
  PassageBiblique,
  PlanItem,
  Sermon,
  SermonTraduction,
  StatutWorkflow,
} from "@/types";
import common from "../common.module.css";

interface FormState {
  slug: string;
  date_culte: string;
  /** UUID du TypeCulte sélectionné. */
  type_culte: string;
  predicateur_id: string;
  serie_id: string;
  numero_dans_serie: string;
  duree_minutes: string;
  thumbnail_url: string;
  audio_url: string;
  fr: SermonTraduction;
  en: SermonTraduction;
  passages: PassageBiblique[];
  citations: CitationBranham[];
  plan: PlanItem[];
}

function blankTraduction(langue: "fr" | "en"): SermonTraduction {
  return {
    langue,
    titre: "",
    titre_em: "",
    description_courte: "",
    youtube_url: "",
  };
}

function blankForm(): FormState {
  return {
    slug: "",
    date_culte: dayjs().format("YYYY-MM-DDTHH:mm"),
    type_culte: "",
    predicateur_id: "",
    serie_id: "",
    numero_dans_serie: "",
    duree_minutes: "",
    thumbnail_url: "",
    audio_url: "",
    fr: blankTraduction("fr"),
    en: blankTraduction("en"),
    passages: [],
    citations: [],
    plan: [],
  };
}

function fromSermon(sermon: Sermon): FormState {
  const traductions = sermon.traductions ?? [];
  const fr = traductions.find((t) => t.langue === "fr") ?? blankTraduction("fr");
  const en = traductions.find((t) => t.langue === "en") ?? blankTraduction("en");
  return {
    slug: sermon.slug,
    date_culte: dayjs(sermon.date_culte).format("YYYY-MM-DDTHH:mm"),
    type_culte: sermon.type_culte_detail?.id ?? sermon.type_culte ?? "",
    predicateur_id:
      typeof sermon.predicateur === "string" ? sermon.predicateur : (sermon.predicateur?.id ?? ""),
    serie_id: typeof sermon.serie === "string" ? sermon.serie : (sermon.serie?.id ?? ""),
    numero_dans_serie: sermon.numero_dans_serie?.toString() ?? "",
    duree_minutes: sermon.duree_minutes?.toString() ?? "",
    thumbnail_url: sermon.thumbnail_url ?? "",
    audio_url: sermon.audio_url ?? "",
    fr,
    en,
    passages: sermon.passages ?? [],
    citations: sermon.citations_branham ?? [],
    plan: sermon.plan ?? [],
  };
}

function toPayload(form: FormState): Partial<Sermon> {
  return {
    slug: form.slug || undefined,
    date_culte: dayjs(form.date_culte).toISOString(),
    type_culte: form.type_culte || undefined,
    predicateur: form.predicateur_id || undefined,
    serie: form.serie_id || null,
    numero_dans_serie: form.numero_dans_serie ? Number(form.numero_dans_serie) : null,
    duree_minutes: form.duree_minutes ? Number(form.duree_minutes) : null,
    thumbnail_url: form.thumbnail_url,
    audio_url: form.audio_url,
    traductions: [form.fr, form.en].filter((t) => t.titre || t.youtube_url),
  } as Partial<Sermon>;
}

export function SermonEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { slug } = useParams<{ slug?: string }>();
  const isNew = !slug;

  const sermonQuery = useQuery({
    queryKey: ["sermon", slug],
    queryFn: () => sermonsApi.getAdmin(slug as string),
    enabled: !isNew,
  });

  const personnesQuery = usePeople();

  const seriesQuery = useQuery({
    queryKey: ["series"],
    queryFn: () => seriesApi.list(),
  });

  const typesCulteQuery = useQuery({
    queryKey: ["types-culte"],
    queryFn: () => typesCulteApi.list(),
    staleTime: 5 * 60_000,
  });

  const [form, setForm] = useState<FormState>(blankForm());
  const [hydrated, setHydrated] = useState(isNew);

  if (!isNew && sermonQuery.data && !hydrated) {
    setForm(fromSermon(sermonQuery.data));
    setHydrated(true);
  }

  const access = useWorkflowAccess(sermonQuery.data);
  const draftGuard = useDraftGuard(form, hydrated);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.fr.titre.trim()) throw new Error("Renseignez le titre du culte en français.");
      if (!form.predicateur_id) throw new Error("Choisissez le prédicateur du culte.");
      if (!personnesQuery.data?.some((p) => p.id === form.predicateur_id && isPreacher(p)))
        throw new Error("Choisissez une personne active ayant le rôle Pasteur ou Prédicateur.");
      const payload = toPayload(form);
      if (isNew) {
        return sermonsApi.create(payload);
      }
      return sermonsApi.update(slug as string, payload);
    },
    onSuccess: (saved) => {
      draftGuard.markSaved();
      // Pré-remplit le cache pour éviter un flash de loading après la redirection.
      queryClient.setQueryData(["sermon", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["sermons-list"] });
      if (isNew) {
        navigate(`/sermons/${saved.slug}`);
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => sermonsApi.soumettre(slug as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sermon", slug] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => sermonsApi.publier(slug as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sermon", slug] });
      void queryClient.invalidateQueries({ queryKey: ["sermons-list"] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: async () => sermonsApi.rejeter(slug as string, ""),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sermon", slug] });
    },
  });
  const archiveMutation = useMutation({
    mutationFn: async () => sermonsApi.archiver(slug as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sermon", slug] });
      void queryClient.invalidateQueries({ queryKey: ["sermons-list"] });
    },
  });
  const wfPending =
    submitMutation.isPending ||
    publishMutation.isPending ||
    rejectMutation.isPending ||
    archiveMutation.isPending;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateTraduction = (langue: "fr" | "en", patch: Partial<SermonTraduction>) =>
    setForm((prev) => ({ ...prev, [langue]: { ...prev[langue], ...patch } }));

  const sermon = sermonQuery.data;

  const operationError =
    saveMutation.error ||
    submitMutation.error ||
    publishMutation.error ||
    rejectMutation.error ||
    archiveMutation.error;
  const locked = sermon?.statut === "publie";
  const busy = wfPending || saveMutation.isPending;
  if (!isNew && !sermonQuery.data)
    return (
      <>
        <Breadcrumb items={[{ label: "Retour à la liste", to: "/sermons" }, { label: "Fiche" }]} />
        <PageHead title="Chargement de la fiche" />
        <PageBody>
          <QueryFeedback
            loading={sermonQuery.isLoading}
            error={sermonQuery.error}
            retry={() => void sermonQuery.refetch()}
          />
        </PageBody>
      </>
    );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Cultes", to: "/sermons" },
          { label: isNew ? "Nouveau sermon" : (sermon?.traductions?.[0]?.titre ?? "Édition") },
        ]}
      />
      <PageHead
        title={isNew ? "Nouveau sermon" : (sermon?.traductions?.[0]?.titre ?? "Édition")}
        lede="Saisissez les métadonnées et le contenu rédactionnel FR/EN. Les passages, citations et plan sont en français."
        actions={
          <div className={common.actions}>
            {sermon ? <StatusBadge statut={sermon.statut as StatutWorkflow} /> : null}
            <Button
              variant="primary"
              onClick={() => saveMutation.mutate()}
              disabled={busy || locked}
            >
              {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {!isNew && sermon?.statut === "brouillon" ? (
              <Button
                variant="primary"
                onClick={() => submitMutation.mutate()}
                disabled={busy || draftGuard.dirty}
              >
                Soumettre à validation
              </Button>
            ) : null}
            {!isNew && sermon?.statut === "en_revue" ? (
              <Button
                variant="success"
                onClick={() => {
                  if (window.confirm("Publier le contenu enregistré sur la vitrine ?"))
                    publishMutation.mutate();
                }}
                disabled={busy || draftGuard.dirty || !access.canValidate}
              >
                {publishMutation.isPending ? "Publication…" : "Publier"}
              </Button>
            ) : null}
            {!isNew && sermon?.statut === "en_revue" ? (
              <Button
                variant="dangerOutline"
                onClick={() => rejectMutation.mutate()}
                disabled={busy || draftGuard.dirty || !access.canValidate}
              >
                Rejeter
              </Button>
            ) : null}
            {!isNew && sermon?.statut === "publie" ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Archiver ce contenu et le retirer de la vitrine ?"))
                    archiveMutation.mutate();
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
          {operationError && (
            <p role="alert" className={common.errorBox}>
              {operationError.message}
            </p>
          )}
          <p className={common.notice} role="status">
            {locked
              ? "Contenu publié : la fiche est en lecture seule. Un validateur peut l’archiver pour permettre sa modification."
              : draftGuard.dirty
                ? "Modifications non enregistrées. Enregistrez avant de soumettre ou valider le contenu."
                : saveMutation.isSuccess
                  ? "Modifications enregistrées."
                  : "Préparez le contenu et enregistrez-le avant de le soumettre à la validation."}
          </p>
          {!isNew &&
            (!access.validator ? (
              <p className={common.notice}>La publication est réservée aux validateurs.</p>
            ) : (
              <div className={common.notice}>
                {access.own && (
                  <p>
                    La validation doit être effectuée par une autre personne que l’auteur ou le
                    dernier éditeur.
                  </p>
                )}
                {!access.recent && <IdentityCheck />}
              </div>
            ))}
          <fieldset disabled={locked || busy} className={common.editor}>
            <section className={common.section}>
              <span className={common.sectionTitle}>Informations générales</span>
              <div className={common.formGrid}>
                <Input
                  label="Date du culte"
                  type="datetime-local"
                  value={form.date_culte}
                  onChange={(event) => updateField("date_culte", event.target.value)}
                />
                <Select
                  label="Type de culte"
                  value={form.type_culte}
                  onChange={(event) => updateField("type_culte", event.target.value)}
                  help={
                    typesCulteQuery.isLoading
                      ? "Chargement…"
                      : "Les types disponibles sont définis par l’équipe d’administration."
                  }
                >
                  <option value="">— Choisir —</option>
                  {typesCulteQuery.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.libelle_fr}
                    </option>
                  ))}
                </Select>
                <PersonneSinglePicker
                  label="Prédicateur"
                  value={form.predicateur_id}
                  onChange={(id) => updateField("predicateur_id", id)}
                  allowedRoles={["pasteur", "predicateur"]}
                  help="Personnes actives ayant le rôle Pasteur ou Prédicateur. Les rôles se gèrent dans Personnes."
                />
                <Select
                  label="Série (facultatif)"
                  value={form.serie_id}
                  onChange={(event) => updateField("serie_id", event.target.value)}
                >
                  <option value="">— Aucune —</option>
                  {seriesQuery.data?.results.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.titre_fr}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Numéro dans la série"
                  type="number"
                  min={1}
                  value={form.numero_dans_serie}
                  onChange={(event) => updateField("numero_dans_serie", event.target.value)}
                />
                <Input
                  label="Durée (min)"
                  type="number"
                  min={0}
                  value={form.duree_minutes}
                  onChange={(event) => updateField("duree_minutes", event.target.value)}
                />
                <Input
                  label="Slug"
                  value={form.slug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  help={
                    isNew
                      ? "Calculé automatiquement à partir du titre FR si vide."
                      : "Modifier avec précaution — les liens publics actuels peuvent casser."
                  }
                />
                <Input
                  label="Miniature (URL override)"
                  type="url"
                  value={form.thumbnail_url}
                  onChange={(event) => updateField("thumbnail_url", event.target.value)}
                  help="Si vide, la miniature YouTube est dérivée automatiquement de l'URL vidéo."
                />
                <Input
                  label="Audio MP3 (URL alternative)"
                  type="url"
                  value={form.audio_url}
                  onChange={(event) => updateField("audio_url", event.target.value)}
                  help="Optionnel : lien vers un MP3 hébergé séparément."
                />
              </div>
            </section>

            <section className={common.section}>
              <span className={common.sectionTitle}>Contenu rédactionnel</span>
              <Tabs
                readOnly={locked}
                items={[
                  {
                    value: "fr",
                    label: "Français",
                    content: (
                      <div className={common.formGrid}>
                        <Input
                          label="Titre"
                          required
                          value={form.fr.titre}
                          onChange={(event) =>
                            updateTraduction("fr", { titre: event.target.value })
                          }
                        />
                        <Input
                          label="Partie italique"
                          value={form.fr.titre_em}
                          onChange={(event) =>
                            updateTraduction("fr", { titre_em: event.target.value })
                          }
                        />
                        <Input
                          label="URL YouTube (FR)"
                          type="url"
                          value={form.fr.youtube_url}
                          onChange={(event) =>
                            updateTraduction("fr", { youtube_url: event.target.value })
                          }
                        />
                        <div className={common.full}>
                          <Textarea
                            label="Description courte"
                            rows={3}
                            maxLength={500}
                            value={form.fr.description_courte}
                            onChange={(event) =>
                              updateTraduction("fr", { description_courte: event.target.value })
                            }
                          />
                        </div>
                      </div>
                    ),
                  },
                  {
                    value: "en",
                    label: "English",
                    content: (
                      <div className={common.formGrid}>
                        <Input
                          label="Title"
                          value={form.en.titre}
                          onChange={(event) =>
                            updateTraduction("en", { titre: event.target.value })
                          }
                        />
                        <Input
                          label="Italic part"
                          value={form.en.titre_em}
                          onChange={(event) =>
                            updateTraduction("en", { titre_em: event.target.value })
                          }
                        />
                        <Input
                          label="YouTube URL (EN)"
                          type="url"
                          value={form.en.youtube_url}
                          onChange={(event) =>
                            updateTraduction("en", { youtube_url: event.target.value })
                          }
                        />
                        <div className={common.full}>
                          <Textarea
                            label="Short description"
                            rows={3}
                            maxLength={500}
                            value={form.en.description_courte}
                            onChange={(event) =>
                              updateTraduction("en", { description_courte: event.target.value })
                            }
                          />
                        </div>
                        <div className={common.full}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateTraduction("en", {
                                titre: form.fr.titre,
                                titre_em: form.fr.titre_em,
                                description_courte: form.fr.description_courte,
                              })
                            }
                          >
                            ↘ Copier FR → EN
                          </Button>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </section>

            <section className={common.section}>
              <span className={common.sectionTitle}>Passages bibliques (FR)</span>
              {form.passages.map((p, idx) => (
                <div key={p.id ?? `new-${idx}`} className={common.subForm}>
                  <Input
                    label="Référence"
                    value={p.reference}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        passages: prev.passages.map((x, i) =>
                          i === idx ? { ...x, reference: event.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <Textarea
                    label="Texte"
                    rows={4}
                    value={p.texte}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        passages: prev.passages.map((x, i) =>
                          i === idx ? { ...x, texte: event.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Trash2 size={14} />}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        passages: prev.passages.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Supprimer
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    passages: [
                      ...prev.passages,
                      {
                        id: -1 - prev.passages.length,
                        ordre: prev.passages.length,
                        reference: "",
                        texte: "",
                      },
                    ],
                  }))
                }
              >
                + Ajouter un passage
              </Button>
            </section>

            <section className={common.section}>
              <span className={common.sectionTitle}>Citations Branham (FR)</span>
              {form.citations.map((c, idx) => (
                <div key={c.id ?? `nc-${idx}`} className={common.subForm}>
                  <Input
                    label="Source"
                    value={c.source}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        citations: prev.citations.map((x, i) =>
                          i === idx ? { ...x, source: event.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <Textarea
                    label="Texte"
                    rows={3}
                    value={c.texte}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        citations: prev.citations.map((x, i) =>
                          i === idx ? { ...x, texte: event.target.value } : x,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    citations: [
                      ...prev.citations,
                      {
                        id: -1 - prev.citations.length,
                        ordre: prev.citations.length,
                        source: "",
                        texte: "",
                      },
                    ],
                  }))
                }
              >
                + Ajouter une citation
              </Button>
            </section>

            <section className={common.section}>
              <span className={common.sectionTitle}>Plan du message (FR)</span>
              {form.plan.map((item, idx) => (
                <div key={item.id ?? `np-${idx}`} className={common.subForm}>
                  <Input
                    label={`${item.numero_romain ?? `${idx + 1}.`} Titre`}
                    value={item.titre}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        plan: prev.plan.map((x, i) =>
                          i === idx ? { ...x, titre: event.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <Textarea
                    label="Description"
                    rows={2}
                    value={item.description}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        plan: prev.plan.map((x, i) =>
                          i === idx ? { ...x, description: event.target.value } : x,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    plan: [
                      ...prev.plan,
                      {
                        id: -1 - prev.plan.length,
                        ordre: prev.plan.length,
                        numero_romain: "",
                        titre: "",
                        description: "",
                      },
                    ],
                  }))
                }
              >
                + Ajouter une étape
              </Button>
            </section>

            {sermon ? (
              <section className={common.section}>
                <span className={common.sectionTitle}>Audit</span>
                <div className={common.audit}>
                  <span>Créé : {dayjs(sermon.cree_le).format("LLL")}</span>
                  <span>Modifié : {dayjs(sermon.modifie_le).format("LLL")}</span>
                  {sermon.publie_le ? (
                    <span>Publié : {dayjs(sermon.publie_le).format("LLL")}</span>
                  ) : null}
                </div>
              </section>
            ) : null}
          </fieldset>
          <SaveFooter onSave={() => saveMutation.mutate()} pending={busy} disabled={locked} />
        </div>
      </PageBody>
    </>
  );
}

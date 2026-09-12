import { ActionError } from "@/components/ui/ActionError";
import { SaveFooter } from "@/components/forms/SaveFooter";
import { usePeople } from "@/lib/people";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { IdentityCheck, useWorkflowAccess } from "@/components/forms/WorkflowAccess";
import { useDraftGuard } from "@/lib/useDraftGuard";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Input, Select, StatusBadge, Toggle } from "@/components/ui";
import { LyricsEditor } from "@/components/forms/LyricsEditor";
import { PersonneMultiSelect } from "@/components/forms/PersonneMultiSelect";
import { PersonneSinglePicker } from "@/components/forms/PersonneSinglePicker";
import {
  cantiquesApi,
  evenementsCantiqueApi,
  famillesCantiqueApi,
  groupesPersonnesApi,
} from "@/api";
import { HttpError } from "@/api/client";
import type {
  Cantique,
  CantiqueTraduction,
  GroupePersonnes,
  StatutWorkflow,
  VerseBlock,
} from "@/types";
import common from "../common.module.css";

interface PassageRow {
  ordre: number;
  titre: string;
  start_sec: number;
  end_sec: number | null;
  interpretes_libelle: string;
  lyrics: VerseBlock[];
}

/** Saisie d'une durée en min:sec via deux champs number distincts (plus simple
 *  qu'un texte « MM:SS »). Renvoie le total en secondes. */
function TimeInput({
  label,
  seconds,
  onChange,
  disabled,
  help,
}: {
  label: string;
  seconds: number | null;
  onChange: (s: number) => void;
  disabled?: boolean;
  help?: string;
}) {
  const mm = seconds != null ? Math.floor(seconds / 60) : 0;
  const ss = seconds != null ? seconds % 60 : 0;
  const set = (m: number, s: number) =>
    onChange(Math.max(0, m) * 60 + Math.min(59, Math.max(0, s)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="number"
          min={0}
          value={String(mm)}
          disabled={disabled}
          onChange={(e) => set(Number.parseInt(e.target.value, 10) || 0, ss)}
          aria-label={`${label} — minutes`}
          style={{
            width: 56,
            padding: "8px 6px",
            textAlign: "center",
            border: "1px solid var(--gray-200)",
            borderRadius: 4,
            fontSize: 14,
            background: disabled ? "var(--gray-100)" : "white",
          }}
        />
        <span style={{ fontWeight: 700, color: "var(--gray-500)" }}>:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={String(ss).padStart(2, "0")}
          disabled={disabled}
          onChange={(e) => set(mm, Number.parseInt(e.target.value, 10) || 0)}
          aria-label={`${label} — secondes`}
          style={{
            width: 56,
            padding: "8px 6px",
            textAlign: "center",
            border: "1px solid var(--gray-200)",
            borderRadius: 4,
            fontSize: 14,
            background: disabled ? "var(--gray-100)" : "white",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--gray-400)" }}>min : sec</span>
      </div>
      {help && <small style={{ fontSize: 11, color: "var(--gray-500)" }}>{help}</small>}
    </div>
  );
}

/** Chips toggle pour choisir les interprètes d'un passage parmi les candidats
 *  (interprètes + lead + membres des chœurs de la chanson). La valeur stockée
 *  reste un libellé texte (concaténation). */
function PassageInterpretesChips({
  candidats,
  value,
  onChange,
}: {
  candidats: { id: string; libelle: string }[];
  value: string;
  onChange: (libelle: string) => void;
}) {
  const selected = value
    ? value
        .split(" · ")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const toggle = (libelle: string) => {
    const next = selected.includes(libelle)
      ? selected.filter((x) => x !== libelle)
      : [...selected, libelle];
    onChange(next.join(" · "));
  };
  if (candidats.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--gray-500)", fontStyle: "italic", margin: "4px 0 0" }}>
        Sélectionne d'abord les interprètes / chœurs de la chanson ci-dessus pour pouvoir les
        attribuer à ce passage.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {candidats.map((c) => {
        const on = selected.includes(c.libelle);
        return (
          <label
            key={c.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              padding: "5px 10px",
              borderRadius: 999,
              cursor: "pointer",
              userSelect: "none",
              background: on
                ? "var(--rst-blue-wash, rgba(30,71,161,0.08))"
                : "var(--gray-50, #f9fafb)",
              border: `1px solid ${on ? "var(--rst-blue, #1e47a1)" : "var(--gray-200)"}`,
              color: on ? "var(--rst-blue-deep, #15366E)" : "var(--ink-1)",
              fontWeight: on ? 600 : 400,
            }}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => toggle(c.libelle)}
              style={{ accentColor: "var(--rst-blue, #1e47a1)", margin: 0 }}
            />
            {c.libelle}
          </label>
        );
      })}
    </div>
  );
}

/** Éditeur inline des passages (medley) / chants (service de chant).
 *  - Début du 1er passage = 0:00 (éditable). Début des suivants = fin du
 *    précédent (auto, lecture seule).
 *  - Interprètes du passage choisis parmi les interprètes/chœurs de la chanson. */
function PassagesEditor({
  passages,
  onChange,
  candidats,
}: {
  passages: PassageRow[];
  onChange: (next: PassageRow[]) => void;
  candidats: { id: string; libelle: string }[];
}) {
  // Recale les débuts en cascade : start[0] reste éditable, start[i>0] = end[i-1].
  const normalize = (rows: PassageRow[]): PassageRow[] =>
    rows.map((p, i) => ({
      ...p,
      ordre: i + 1,
      start_sec: i === 0 ? p.start_sec : (rows[i - 1].end_sec ?? p.start_sec),
    }));

  const addPassage = () => {
    const prev = passages[passages.length - 1];
    const start = prev ? (prev.end_sec ?? prev.start_sec) : 0;
    onChange(
      normalize([
        ...passages,
        {
          ordre: passages.length + 1,
          titre: "",
          start_sec: start,
          end_sec: null,
          interpretes_libelle: "",
          lyrics: [],
        },
      ]),
    );
  };
  const removeAt = (idx: number) => onChange(normalize(passages.filter((_, i) => i !== idx)));
  const patchAt = (idx: number, patch: Partial<PassageRow>) =>
    onChange(normalize(passages.map((p, i) => (i === idx ? { ...p, ...patch } : p))));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
      {passages.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gray-500)", margin: 0 }}>
          Aucun passage. Clique <strong>+ Ajouter un passage</strong> pour commencer.
        </p>
      ) : (
        passages.map((p, idx) => (
          <div
            key={idx}
            style={{
              padding: 14,
              border: "1px solid var(--gray-200)",
              borderRadius: 6,
              background: "var(--gray-50, #f9fafb)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--rst-blue, #1e47a1)",
                  minWidth: 28,
                }}
              >
                #{idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Input
                  label="Titre du chant"
                  value={p.titre}
                  onChange={(e) => patchAt(idx, { titre: e.target.value })}
                  placeholder="ex. J'ai le sang"
                />
              </div>
              <Button variant="dangerOutline" size="sm" onClick={() => removeAt(idx)}>
                Retirer
              </Button>
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <TimeInput
                label="Début"
                seconds={p.start_sec}
                disabled={idx > 0}
                onChange={(s) => patchAt(idx, { start_sec: s })}
                help={idx === 0 ? "Par défaut 0:00" : "Auto : fin du chant précédent"}
              />
              <TimeInput
                label="Fin"
                seconds={p.end_sec}
                onChange={(s) => patchAt(idx, { end_sec: s })}
                help="Définit aussi le début du chant suivant"
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>
                Qui chante ce passage ? (parmi les interprètes / chœurs de la chanson)
              </label>
              <PassageInterpretesChips
                candidats={candidats}
                value={p.interpretes_libelle}
                onChange={(libelle) => patchAt(idx, { interpretes_libelle: libelle })}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--gray-700)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Paroles de ce chant
              </label>
              <small
                style={{
                  fontSize: 11,
                  color: "var(--gray-500)",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Affichées automatiquement sur la vitrine lorsque la vidéo atteint ce passage (onglet
                « Paroles »).
              </small>
              <LyricsEditor
                blocks={p.lyrics}
                onChange={(next: VerseBlock[]) => patchAt(idx, { lyrics: next })}
              />
            </div>
          </div>
        ))
      )}
      <div>
        <Button variant="ghost" size="sm" onClick={addPassage}>
          + Ajouter un passage
        </Button>
      </div>
    </div>
  );
}

/** Sélecteur multi-checkbox pour les Groupes de personnes (chœurs, etc.).
 *  Simple et compact : checkbox liste des groupes actifs disponibles. */
function GroupesMultiSelect({
  label,
  value,
  groupes,
  onChange,
  help,
}: {
  label: string;
  value: string[];
  groupes: GroupePersonnes[];
  onChange: (ids: string[]) => void;
  help?: string;
}) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };
  const actifs = groupes.filter((g) => g.actif);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>{label}</label>
      {actifs.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gray-500)", margin: "4px 0", fontStyle: "italic" }}>
          Aucun groupe actif disponible. Crée-en via le bouton « Gérer les groupes » sur la page
          Personnes.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: 10,
            border: "1px solid var(--gray-200)",
            borderRadius: 6,
            background: "var(--surface)",
          }}
        >
          {actifs.map((g) => (
            <label
              key={g.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                padding: "6px 10px",
                background: value.includes(g.id)
                  ? "var(--rst-blue-wash, rgba(30, 71, 161, 0.08))"
                  : "var(--gray-50, #f9fafb)",
                border: `1px solid ${
                  value.includes(g.id) ? "var(--rst-blue, #1e47a1)" : "var(--gray-200)"
                }`,
                borderRadius: 999,
                cursor: "pointer",
                userSelect: "none",
                color: value.includes(g.id) ? "var(--rst-blue-deep, #15366E)" : "var(--ink-1)",
                fontWeight: value.includes(g.id) ? 600 : 400,
              }}
            >
              <input
                type="checkbox"
                checked={value.includes(g.id)}
                onChange={() => toggle(g.id)}
                style={{
                  accentColor: "var(--rst-blue, #1e47a1)",
                  margin: 0,
                }}
              />
              {g.nom_fr}
              <span style={{ fontSize: 11, color: "var(--gray-500)" }}>
                · {g.nombre_membres ?? 0}
              </span>
            </label>
          ))}
        </div>
      )}
      {help && <small style={{ fontSize: 11, color: "var(--gray-500)" }}>{help}</small>}
    </div>
  );
}

function blankTraduction(langue: "fr" | "en"): CantiqueTraduction {
  return {
    langue,
    titre: "",
    titre_em: "",
    detail_by: "",
    youtube_url: "",
    lyrics: [],
  };
}

interface DraftPassage {
  ordre: number;
  titre: string;
  start_sec: number;
  end_sec: number | null;
  interpretes_libelle: string;
  lyrics: VerseBlock[];
}

interface DraftState {
  numero_recueil: string;
  /** UUID de la FamilleCantique choisie. */
  famille: string;
  /** UUID de l'EvenementCantique (Veillée, Pâques…). Vide = pas d'événement. */
  evenement: string;
  /** UUIDs des Personnes interprètes (M2M). */
  interpretes: string[];
  /** UUIDs des GroupePersonnes interprètes (M2M, ex. « Chœurs »). */
  groupes_interpretes: string[];
  /** UUID de la Personne lead. Vide = pas de lead (tous à parité). */
  interprete_lead: string;
  est_medley: boolean;
  passages: DraftPassage[];
  duration: string;
  recording_type: string;
  date_enregistrement: string;
  audio_url: string;
  est_vedette: boolean;
  fr: CantiqueTraduction;
}

function emptyDraft(): DraftState {
  return {
    numero_recueil: "",
    famille: "",
    evenement: "",
    interpretes: [],
    groupes_interpretes: [],
    interprete_lead: "",
    est_medley: false,
    passages: [],
    duration: "",
    recording_type: "",
    date_enregistrement: "",
    audio_url: "",
    est_vedette: false,
    fr: blankTraduction("fr"),
  };
}

type FieldErrors = Record<string, string>;

function flattenDrfErrors(details: unknown): { fields: FieldErrors; nonField: string[] } {
  const fields: FieldErrors = {};
  const nonField: string[] = [];
  if (!details || typeof details !== "object") return { fields, nonField };
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const text = value.map(String).join(" ; ");
      if (key === "non_field_errors") nonField.push(text);
      else fields[key] = text;
    } else if (typeof value === "string") {
      if (key === "non_field_errors") nonField.push(value);
      else fields[key] = value;
    }
  }
  return { fields, nonField };
}

export function CantiqueEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { slug } = useParams<{ slug?: string }>();
  const isNew = !slug;

  const query = useQuery({
    queryKey: ["cantique", slug],
    queryFn: () => cantiquesApi.get(slug as string),
    enabled: !isNew,
  });

  const famillesQuery = useQuery({
    queryKey: ["familles-cantique"],
    queryFn: () => famillesCantiqueApi.list(),
    staleTime: 5 * 60_000,
  });

  const evenementsQuery = useQuery({
    queryKey: ["evenements-cantique"],
    queryFn: () => evenementsCantiqueApi.list(),
    staleTime: 60_000,
  });

  const groupesQuery = useQuery({
    queryKey: ["groupes-personnes"],
    queryFn: () => groupesPersonnesApi.list(),
    staleTime: 60_000,
  });

  const personnesQuery = usePeople();

  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [hydrated, setHydrated] = useState(isNew);

  if (query.data && !hydrated) {
    const traductions = query.data.traductions ?? [];
    const fr = traductions.find((t) => t.langue === "fr") ?? blankTraduction("fr");
    // Extraire les UUIDs des interprètes (peut être objet Personne ou string selon le serializer).
    const interpretesIds = (query.data.interpretes ?? [])
      .map((x) => (typeof x === "string" ? x : x.id))
      .filter(Boolean);
    const groupesIds = (query.data.groupes_interpretes ?? [])
      .map((x) => (typeof x === "string" ? x : x.id))
      .filter(Boolean);
    setDraft({
      numero_recueil: query.data.numero_recueil?.toString() ?? "",
      famille: query.data.famille_detail?.id ?? query.data.famille ?? "",
      evenement: query.data.evenement_detail?.id ?? query.data.evenement ?? "",
      interpretes: interpretesIds,
      groupes_interpretes: groupesIds,
      interprete_lead: query.data.interprete_lead_detail?.id ?? query.data.interprete_lead ?? "",
      est_medley: query.data.est_medley ?? false,
      passages: (query.data.passages ?? []).map((p) => ({
        ordre: p.ordre,
        titre: p.titre,
        start_sec: p.start_sec,
        end_sec: p.end_sec,
        interpretes_libelle: p.interpretes_libelle,
        lyrics: p.lyrics ?? [],
      })),
      duration: query.data.duration,
      recording_type: query.data.recording_type,
      date_enregistrement: query.data.date_enregistrement || query.data.recorded_at || "",
      audio_url: query.data.audio_url ?? "",
      est_vedette: query.data.est_vedette,
      fr,
    });
    setHydrated(true);
  }

  const selectedFamilleCode = useMemo(() => {
    if (!draft.famille) return null;
    return famillesQuery.data?.find((f) => f.id === draft.famille)?.code ?? null;
  }, [draft.famille, famillesQuery.data]);

  const isRecueil = selectedFamilleCode === "recueil";
  const isAdoration = selectedFamilleCode === "adoration";
  const isSpecial = selectedFamilleCode === "special";
  // Les passages servent à 2 cas : medley (cantique spécial) OU découpage des
  // chants d'un service de chant (adoration). Pour l'adoration, ils sont
  // toujours visibles ; pour le spécial, seulement si le toggle medley est actif.
  const showPassages = isAdoration || (isSpecial && draft.est_medley);
  // Paroles structurées (couplet/refrain/pont) : pertinentes pour recueil et
  // cantique spécial simple. Pas pour un service de chant (qui référence
  // plusieurs chants via les passages, sans paroles propres).
  const showLyrics = !isAdoration;

  // Candidats interprètes d'un passage = interprètes individuels sélectionnés
  // + membres des chœurs sélectionnés (dédupliqués par libellé).
  const passageCandidats = useMemo(() => {
    const out: { id: string; libelle: string }[] = [];
    const seen = new Set<string>();
    const push = (id: string, libelle: string) => {
      if (!libelle || seen.has(id)) return;
      seen.add(id);
      out.push({ id, libelle });
    };
    const personnes = personnesQuery.data ?? [];
    for (const pid of draft.interpretes) {
      const p = personnes.find((x) => x.id === pid);
      if (p) push(p.id, p.libelle);
    }
    const groupes = groupesQuery.data?.results ?? [];
    for (const gid of draft.groupes_interpretes) {
      const g = groupes.find((x) => x.id === gid);
      for (const m of g?.membres_detail ?? []) push(m.id, m.libelle);
    }
    return out;
  }, [draft.interpretes, draft.groupes_interpretes, personnesQuery.data, groupesQuery.data]);

  /** À la sélection de « Service de chant », on applique les défauts métier :
   *  type d'enregistrement = culte, et présélection des groupes « chœur ». */
  const onFamilleChange = (familleId: string) => {
    update("famille", familleId);
    const code = famillesQuery.data?.find((f) => f.id === familleId)?.code;
    if (code === "adoration") {
      setDraft((prev) => {
        const next = { ...prev, famille: familleId };
        if (!prev.recording_type) next.recording_type = "culte";
        if (prev.groupes_interpretes.length === 0) {
          const choeurs = (groupesQuery.data?.results ?? [])
            .filter((g) => /ch(o|œ)eurs?/i.test(g.nom_fr))
            .map((g) => g.id);
          if (choeurs.length > 0) next.groupes_interpretes = choeurs;
        }
        return next;
      });
    }
  };

  const validate = (): string | null => {
    if (!draft.famille) return "Sélectionnez une famille de cantique.";
    if (isRecueil && !draft.numero_recueil.trim()) {
      return "Pour un cantique du recueil, indiquez le numéro entier (utilisé pour le tri et la référence affichée).";
    }
    if (!draft.fr.titre.trim()) return "Le titre est requis.";
    if (draft.interprete_lead && !draft.interpretes.includes(draft.interprete_lead))
      return "La voix principale doit faire partie des interprètes sélectionnés.";
    return null;
  };

  const [clientError, setClientError] = useState<string | null>(null);

  const access = useWorkflowAccess(query.data);
  const draftGuard = useDraftGuard(draft, hydrated);

  const save = useMutation({
    mutationFn: () => {
      const payload: Partial<Cantique> & {
        interpretes?: string[];
        groupes_interpretes?: string[];
      } = {
        // Pas de `numero` envoyé → le backend l'auto-attribue selon la famille.
        numero_recueil: isRecueil && draft.numero_recueil ? Number(draft.numero_recueil) : null,
        famille: draft.famille,
        // evenement vide string → null pour respecter la FK nullable côté DRF.
        evenement: draft.evenement || null,
        interpretes: draft.interpretes,
        groupes_interpretes: draft.groupes_interpretes,
        interprete_lead: draft.interprete_lead || null,
        est_medley: draft.est_medley,
        // Les passages valent pour un medley (spécial) OU un service de chant
        // (adoration). Sinon on les vide.
        passages: showPassages ? draft.passages : [],
        duration: draft.duration,
        recording_type: draft.recording_type,
        date_enregistrement: draft.date_enregistrement,
        audio_url: draft.audio_url,
        est_vedette: draft.est_vedette,
        traductions: [draft.fr].filter((t) => t.titre || t.lyrics.length > 0),
      };
      return isNew ? cantiquesApi.create(payload) : cantiquesApi.update(slug as string, payload);
    },
    onSuccess: (saved) => {
      draftGuard.markSaved();
      // Pré-remplit le cache pour la nouvelle page d'édition (évite un flash de loading
      // après la redirection, et donne accès à `traductions` / `roles_detail` tout de suite).
      queryClient.setQueryData(["cantique", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["cantiques-list"] });
      if (isNew) navigate(`/cantiques/${saved.slug}`);
    },
  });

  const handleSubmit = () => {
    const error = validate();
    if (error) {
      setClientError(error);
      return;
    }
    setClientError(null);
    save.mutate();
  };

  const serverError = save.error instanceof HttpError ? save.error : null;
  const { fields: fieldErrors, nonField: nonFieldErrors } = useMemo(
    () => (serverError ? flattenDrfErrors(serverError.details) : { fields: {}, nonField: [] }),
    [serverError],
  );

  const update = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const updateTr = (patch: Partial<CantiqueTraduction>) =>
    setDraft((prev) => ({ ...prev, fr: { ...prev.fr, ...patch } }));

  const cantique = query.data;
  const statut = cantique?.statut as StatutWorkflow | undefined;

  // Transitions workflow : 5 statuts (brouillon → en_revue → publie | rejete, archive depuis publie).
  // Le backend valide la transition côté serveur, on n'affiche que les boutons applicables au
  // statut courant pour ne pas inviter l'utilisateur à des actions qui seront rejetées.
  const soumettre = useMutation({
    mutationFn: () => cantiquesApi.soumettre(slug as string),
    onSuccess: (saved) => queryClient.setQueryData(["cantique", saved.slug], saved),
  });
  const publier = useMutation({
    mutationFn: () => cantiquesApi.publier(slug as string),
    onSuccess: (saved) => {
      queryClient.setQueryData(["cantique", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["cantiques-list"] });
    },
  });
  const rejeter = useMutation({
    mutationFn: () => cantiquesApi.rejeter(slug as string),
    onSuccess: (saved) => queryClient.setQueryData(["cantique", saved.slug], saved),
  });
  const archiver = useMutation({
    mutationFn: () => cantiquesApi.archiver(slug as string),
    onSuccess: (saved) => {
      queryClient.setQueryData(["cantique", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["cantiques-list"] });
    },
  });
  const desarchiver = useMutation({
    mutationFn: () => cantiquesApi.desarchiver(slug as string),
    onSuccess: (saved) => {
      queryClient.setQueryData(["cantique", saved.slug], saved);
      void queryClient.invalidateQueries({ queryKey: ["cantiques-list"] });
    },
  });
  const supprimer = useMutation({
    mutationFn: () => cantiquesApi.remove(slug as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cantiques-list"] });
      navigate("/cantiques");
    },
  });

  const workflowPending =
    soumettre.isPending ||
    publier.isPending ||
    rejeter.isPending ||
    archiver.isPending ||
    desarchiver.isPending ||
    supprimer.isPending;

  const operationError =
    save.error ||
    soumettre.error ||
    publier.error ||
    rejeter.error ||
    archiver.error ||
    desarchiver.error ||
    supprimer.error;
  const locked = cantique?.statut === "publie";
  const busy = workflowPending || save.isPending;
  if (!isNew && !query.data)
    return (
      <>
        <Breadcrumb
          items={[{ label: "Retour à la liste", to: "/cantiques" }, { label: "Fiche" }]}
        />
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
          { label: "Cantiques", to: "/cantiques" },
          { label: isNew ? "Nouveau" : (cantique?.traductions?.[0]?.titre ?? "Édition") },
        ]}
      />
      <PageHead
        title={isNew ? "Nouveau cantique" : (cantique?.traductions?.[0]?.titre ?? "Édition")}
        lede={
          !isNew && cantique
            ? `Référence : ${cantique.numero}`
            : "Choisissez la famille, les interprètes et le contenu du cantique."
        }
        actions={
          <div className={common.actions}>
            {cantique ? <StatusBadge statut={cantique.statut as StatutWorkflow} /> : null}
            <Button variant="primary" onClick={handleSubmit} disabled={busy || locked}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {!isNew && statut === "brouillon" ? (
              <Button
                variant="ghost"
                onClick={() => soumettre.mutate()}
                disabled={busy || draftGuard.dirty}
              >
                Soumettre à validation
              </Button>
            ) : null}
            {!isNew && statut === "en_revue" ? (
              <Button
                variant="success"
                onClick={() => {
                  if (window.confirm("Publier le contenu enregistré sur la vitrine ?"))
                    publier.mutate();
                }}
                disabled={busy || draftGuard.dirty || !access.canValidate}
              >
                {publier.isPending ? "Publication…" : "Publier"}
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
            {!isNew && statut === "publie" ? (
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
            {!isNew && statut === "archive" ? (
              <Button
                variant="success"
                onClick={() => desarchiver.mutate()}
                disabled={busy || draftGuard.dirty || !access.canValidate}
              >
                {desarchiver.isPending ? "Désarchivage…" : "Désarchiver"}
              </Button>
            ) : null}
            {!isNew ? (
              <Button
                variant="dangerOutline"
                onClick={() => {
                  if (window.confirm("Retirer ce cantique des listes ?")) {
                    supprimer.mutate();
                  }
                }}
                disabled={busy || locked || !access.canManage}
              >
                Supprimer
              </Button>
            ) : null}
          </div>
        }
      />
      <PageBody>
        <div className={common.editor}>
          <ActionError error={operationError} />
          <p className={common.notice} role="status">
            {locked
              ? "Contenu publié : la fiche est en lecture seule. Un validateur peut l’archiver pour permettre sa modification."
              : draftGuard.dirty
                ? "Modifications non enregistrées. Enregistrez avant de soumettre ou valider le contenu."
                : save.isSuccess
                  ? "Modifications enregistrées."
                  : "Préparez le contenu et enregistrez-le avant de le soumettre à la validation."}
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
          <fieldset disabled={locked || busy} className={common.editor}>
            {clientError ? (
              <div className={common.errorBox} role="alert">
                <strong>Champ requis manquant :</strong> {clientError}
              </div>
            ) : null}

            {serverError ? (
              <div className={common.errorBox} role="alert">
                <strong>Le serveur a refusé l'enregistrement :</strong> {serverError.message}
                {nonFieldErrors.length > 0 ? (
                  <ul style={{ margin: "8px 0 0 20px" }}>
                    {nonFieldErrors.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                ) : null}
                {Object.keys(fieldErrors).length > 0 ? (
                  <ul style={{ margin: "8px 0 0 20px" }}>
                    {Object.entries(fieldErrors).map(([field, msg]) => (
                      <li key={field}>
                        <em>{field}</em> : {msg}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <section className={common.section}>
              <span className={common.sectionTitle}>Informations générales</span>
              <div className={common.formGrid}>
                <Select
                  label="Famille"
                  required
                  value={draft.famille}
                  onChange={(event) => onFamilleChange(event.target.value)}
                  help={
                    famillesQuery.isLoading
                      ? "Chargement…"
                      : "Recueil, cantique spécial, ou service de chant."
                  }
                >
                  <option value="">— Choisir —</option>
                  {famillesQuery.data?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.libelle_fr}
                    </option>
                  ))}
                </Select>

                {isRecueil ? (
                  <Input
                    label="Numéro du recueil"
                    required
                    type="number"
                    min={1}
                    value={draft.numero_recueil}
                    onChange={(event) => update("numero_recueil", event.target.value)}
                    help="Numéro entier du recueil officiel. Sera utilisé comme référence affichée et pour récupérer automatiquement les paroles (à venir)."
                  />
                ) : (
                  <Input
                    label="Référence"
                    value={cantique?.numero ?? ""}
                    disabled
                    help={
                      isNew
                        ? "Attribuée automatiquement (S001 pour spécial, A001 pour adoration)."
                        : "Référence générée à la création."
                    }
                  />
                )}

                <div className={common.full}>
                  <Select
                    label="Événement liturgique (optionnel)"
                    value={draft.evenement}
                    onChange={(event) => update("evenement", event.target.value)}
                    help="Rattache ce cantique à un événement (Veillée, Pâques…). Géré via le bouton « Gérer les événements » sur la page Cantiques."
                  >
                    <option value="">— Aucun événement —</option>
                    {(evenementsQuery.data?.results ?? []).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.nom_fr}
                        {ev.date_evenement ? ` (${ev.date_evenement})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className={common.full}>
                  <PersonneMultiSelect
                    label="Interprètes (personnes individuelles)"
                    value={draft.interpretes}
                    onChange={(ids) => update("interpretes", ids)}
                    placeholder="Tape un nom et choisis dans la liste…"
                    help="Recherche dans la base des Personnes (musiciens, solistes…). Pour le chœur entier, utilise plutôt le sélecteur de groupes ci-dessous."
                  />
                </div>

                <div className={common.full}>
                  <GroupesMultiSelect
                    label="Groupes interprètes (ex. « Chœurs »)"
                    value={draft.groupes_interpretes}
                    groupes={groupesQuery.data?.results ?? []}
                    onChange={(ids) => update("groupes_interpretes", ids)}
                    help="Sélectionne un ou plusieurs groupes. Crée-les via le bouton « Gérer les groupes » sur la page Personnes. Cumulables avec les interprètes individuels."
                  />
                </div>

                <div className={common.full}>
                  <PersonneSinglePicker
                    label={isAdoration ? "Chantre (optionnel)" : "Voix principale (facultatif)"}
                    value={draft.interprete_lead}
                    onChange={(id) => update("interprete_lead", id)}
                    placeholder={
                      draft.interpretes.length === 0
                        ? "Sélectionne d'abord des interprètes ci-dessus…"
                        : isAdoration
                          ? "Choisir le chantre principal…"
                          : "Choisir le chanteur principal parmi les interprètes…"
                    }
                    // Le lead doit faire partie des interprètes sélectionnés.
                    restrictToIds={draft.interpretes}
                    invalidNote="La voix principale sélectionnée ne fait pas partie des interprètes sélectionnés."
                    help={
                      isAdoration
                        ? "Le chantre qui conduit le service. Les chœurs accompagnent (présélectionnés par défaut)."
                        : "Si rempli, cette personne est le chanteur principal ; les autres interprètes et groupes deviennent ses accompagnateurs. Laisse vide si tout le monde chante à parité."
                    }
                  />
                </div>

                {/* Durée et Audio MP3 retirés (non pertinents pour cantiques/services). */}

                <Select
                  label="Type d'enregistrement"
                  value={draft.recording_type}
                  onChange={(event) => update("recording_type", event.target.value)}
                  help={
                    isAdoration ? "Pré-réglé sur « Culte » pour un service de chant." : undefined
                  }
                >
                  <option value="">—</option>
                  <option value="studio">Studio</option>
                  <option value="culte">Culte</option>
                  <option value="live">Live</option>
                </Select>

                {(() => {
                  // Si un événement avec date est rattaché, le cantique hérite
                  // de cette date — on désactive le champ et on affiche la
                  // valeur héritée pour éviter la double saisie / la confusion.
                  const ev = evenementsQuery.data?.results.find((e) => e.id === draft.evenement);
                  const heritedFromEvent = ev?.date_evenement ?? null;
                  if (heritedFromEvent) {
                    return (
                      <Input
                        label="Date d'enregistrement"
                        type="date"
                        value={heritedFromEvent}
                        readOnly
                        help={`Date héritée de l'événement « ${ev?.nom_fr ?? ""} ». Pour la changer, modifie la date côté événement (« Gérer les événements »).`}
                      />
                    );
                  }
                  return (
                    <Input
                      label="Date d'enregistrement"
                      type="date"
                      value={draft.date_enregistrement}
                      onChange={(event) => update("date_enregistrement", event.target.value)}
                      help="Sélectionne la date dans le calendrier. Laisser vide si pas connue. Si tu rattaches un événement avec une date, cette date sera héritée automatiquement."
                    />
                  );
                })()}

                {/* Audio MP3 retiré (non pertinent). */}

                <div>
                  <Toggle
                    checked={draft.est_vedette}
                    onChange={(next) => update("est_vedette", next)}
                    label="Cantique vedette (carte 2×2 en avant)"
                  />
                </div>
              </div>
            </section>

            {/* ── Medley (cantique spécial uniquement) ── */}
            {isSpecial && (
              <section className={common.section}>
                <span className={common.sectionTitle}>§ Medley</span>
                <p className={common.notice}>
                  Coche « Cantique medley » si la vidéo enchaîne plusieurs sous-cantiques. Tu peux
                  alors saisir chaque passage avec son titre et ses bornes (format MM:SS, ex. 1:30).
                </p>
                <Toggle
                  checked={draft.est_medley}
                  onChange={(v) => update("est_medley", v)}
                  label="Cantique medley (plusieurs sous-cantiques dans une seule vidéo)"
                />
              </section>
            )}

            {/* ── Chants du service / passages medley ── */}
            {showPassages && (
              <section className={common.section}>
                <span className={common.sectionTitle}>
                  {isAdoration ? "§ Chants du service" : "§ Passages du medley"}
                </span>
                <p className={common.notice}>
                  {isAdoration
                    ? "Découpe le service en chants : de telle minute à telle minute, indique le chant interprété (format MM:SS, ex. 0:00 → 4:15). À l'avenir, ces chants pourront être reliés au recueil pour afficher les paroles automatiquement."
                    : "Saisis chaque sous-cantique du medley avec son titre et ses bornes (format MM:SS)."}
                </p>
                <PassagesEditor
                  passages={draft.passages}
                  onChange={(passages) => update("passages", passages)}
                  candidats={passageCandidats}
                />
              </section>
            )}

            <section className={common.section}>
              <span className={common.sectionTitle}>
                {showLyrics ? "Contenu — titre, vidéo & paroles" : "Titre & vidéo"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className={common.formGrid}>
                  <Input
                    label={isAdoration ? "Titre du service" : "Titre"}
                    required
                    value={draft.fr.titre}
                    onChange={(event) => updateTr({ titre: event.target.value })}
                  />
                  <Input
                    label="URL YouTube"
                    type="url"
                    value={draft.fr.youtube_url}
                    onChange={(event) => updateTr({ youtube_url: event.target.value })}
                    help={
                      isAdoration
                        ? "Lien vers la vidéo complète du service de chant."
                        : "Lien vers la vidéo principale du cantique."
                    }
                  />
                </div>
                {isRecueil ? (
                  <p className={common.notice}>
                    💡 Cantique du recueil : les paroles ci-dessous sont éditables. Si tu importes
                    plus tard un fichier JSON du recueil complet (commande{" "}
                    <code>python manage.py import_recueil</code>), elles seront pré-remplies
                    automatiquement pour les nouveaux cantiques.
                  </p>
                ) : null}
                {showLyrics ? (
                  <LyricsEditor
                    blocks={draft.fr.lyrics}
                    onChange={(next: VerseBlock[]) => updateTr({ lyrics: next })}
                  />
                ) : (
                  <p className={common.notice}>
                    Un service de chant n'a pas de paroles propres : il enchaîne plusieurs chants
                    (voir « § Chants du service » ci-dessus).
                  </p>
                )}
              </div>
            </section>
          </fieldset>
          <SaveFooter onSave={handleSubmit} pending={busy} disabled={locked} />
        </div>
      </PageBody>
    </>
  );
}

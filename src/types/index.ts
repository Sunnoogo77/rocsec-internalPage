/**
 * Types miroirs des serializers Django.
 *
 * Maintenus à la main pour rester transparents aux relectures et éviter
 * une étape de codegen OpenAPI en V1. Toute évolution backend doit être
 * répliquée ici.
 */

export type Lang = "fr" | "en";

export type StatutWorkflow =
  | "brouillon"
  | "en_revue"
  | "publie"
  | "rejete"
  | "archive";

export type StatutTemoignage = "recu" | "en_revue" | "publie" | "rejete";

export type StatutTemporel = "a-venir" | "aujourd-hui" | "passee";

export type Role = "editeur" | "validateur";

export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_staff: boolean;
  is_superuser: boolean;
  has_2fa: boolean;
  must_change_password: boolean;
  last_login: string | null;
  date_joined: string;
}

export interface RolePersonne {
  id: string;
  code: string;
  libelle_fr: string;
  libelle_en: string;
  actif: boolean;
  ordre: number;
}

export interface Personne {
  id: string;
  civilite: string;
  prenom: string;
  nom: string;
  nom_affichage: string;
  libelle: string;
  /** Rôle dominant — CharField legacy, conservé pour compat. */
  role_principal: string;
  /** UUIDs des RolePersonne associés (M2M, lecture/écriture). */
  roles?: string[];
  /** Détail dénormalisé des rôles (read-only, fourni par le serializer). */
  roles_detail?: RolePersonne[];
  photo_url: string | null;
  bio_courte_fr: string;
  bio_courte_en: string;
  actif: boolean;
  cree_le: string;
  modifie_le: string;
}

export interface Serie {
  id: string;
  titre_fr: string;
  titre_en: string;
  description_fr: string;
  description_en: string;
  close: boolean;
  cree_le: string;
  modifie_le: string;
}

/** Groupe de personnes (ex. « Chœurs »). Une Personne peut appartenir à plusieurs. */
export interface GroupePersonnes {
  id: string;
  nom_fr: string;
  nom_en: string;
  description_fr: string;
  description_en: string;
  /** UUIDs en écriture, objets nested en lecture. */
  membres: string[] | Personne[];
  membres_detail?: Personne[];
  nombre_membres?: number;
  actif: boolean;
  cree_le: string;
  modifie_le: string;
}

/** Événement liturgique regroupant plusieurs cantiques (Veillée, Pâques…). */
export interface EvenementCantique {
  id: string;
  nom_fr: string;
  nom_en: string;
  description_fr: string;
  description_en: string;
  date_evenement: string | null;
  close: boolean;
  nombre_cantiques?: number;
  cree_le: string;
  modifie_le: string;
}

export interface PassageBiblique {
  id: number;
  ordre: number;
  reference: string;
  texte: string;
}

export interface CitationBranham {
  id: number;
  ordre: number;
  source: string;
  texte: string;
}

export interface PlanItem {
  id: number;
  ordre: number;
  numero_romain: string;
  titre: string;
  description: string;
}

export interface SermonTraduction {
  langue: Lang;
  titre: string;
  titre_em: string;
  description_courte: string;
  youtube_url: string;
}

export interface TypeCulte {
  id: string;
  code: string;
  libelle_fr: string;
  libelle_en: string;
  actif: boolean;
  ordre: number;
}

export interface Sermon {
  id: string;
  slug: string;
  serie: Serie | string | null;
  /** Copie imbriquée de la série côté admin (read-only) — utile pour la liste. */
  serie_detail?: Serie | null;
  numero_dans_serie: number | null;
  date_culte: string;
  /** UUID du TypeCulte en lecture/écriture admin. */
  type_culte: string;
  /** Détail du TypeCulte renvoyé par le serializer admin (read-only). */
  type_culte_detail?: TypeCulte | null;
  predicateur: Personne | string;
  /** Copie imbriquée du prédicateur côté admin (read-only). */
  predicateur_detail?: Personne | null;
  duree_minutes: number | null;
  thumbnail_url: string;
  audio_url: string;
  statut: StatutWorkflow;
  publie_le: string | null;
  supprime_le: string | null;
  nombre_vues: number;
  traductions: SermonTraduction[];
  passages: PassageBiblique[];
  citations_branham: CitationBranham[];
  plan: PlanItem[];
  cree_par: string | null;
  modifie_par: string | null;
  valide_par: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface VerseBlock {
  type: "verse" | "refrain" | "pont";
  label: string;
  lines: string[];
}

export interface CantiqueTraduction {
  langue: Lang;
  titre: string;
  titre_em: string;
  detail_by: string;
  youtube_url: string;
  lyrics: VerseBlock[];
}

export interface CantiqueOccurrence {
  id: number;
  video_url: string;
  start_sec: number | null;
  end_sec: number | null;
  interpretes: string[];
  interpretes_libelle: string;
  contexte: string;
  date_evenement: string | null;
  session_adoration: string | null;
  session_adoration_slug: string | null;
  ordre: number;
}

/** Sous-cantique d'un medley : nom + bornes start/end en secondes. */
export interface CantiquePassage {
  id?: number;
  ordre: number;
  titre: string;
  start_sec: number;
  end_sec: number | null;
  interpretes_libelle: string;
  lyrics: VerseBlock[];
}

export interface SessionAdorationCantique {
  id: number;
  cantique: string;
  cantique_slug: string;
  cantique_titre: string;
  ordre: number;
  start_sec: number;
  end_sec: number | null;
  titre_dans_session: string;
}

export interface SessionAdorationTraduction {
  langue: Lang;
  titre: string;
  description: string;
}

export interface SessionAdoration {
  id: string;
  slug: string;
  date: string;
  video_url: string;
  audio_url: string;
  duree_minutes: number | null;
  evenement: string;
  thumbnail_url: string;
  interpretes: Personne[] | string[];
  interpretes_libelle: string;
  traductions: SessionAdorationTraduction[];
  cantiques_contenus: SessionAdorationCantique[];
  statut: StatutWorkflow;
  publie_le: string | null;
  supprime_le: string | null;
  nombre_vues: number;
  cree_par: string | null;
  modifie_par: string | null;
  valide_par: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface FamilleCantique {
  id: string;
  code: string;
  libelle_fr: string;
  libelle_en: string;
  actif: boolean;
  ordre: number;
}

export interface Cantique {
  id: string;
  slug: string;
  numero: string;
  numero_recueil: number | null;
  /** UUID de la FamilleCantique en lecture/écriture admin. */
  famille: string;
  /** Détail dénormalisé renvoyé par les serializers (read-only). */
  famille_detail?: FamilleCantique | null;
  interpretes: Personne[] | string[];
  interpretes_libelle: string;
  /** Copie nested read-only des Personne interprètes (renvoyé par le serializer admin). */
  interpretes_detail?: Personne[];
  /** Groupes interprètes (ex: « Chœurs »). UUIDs en écriture, nested en lecture. */
  groupes_interpretes?: string[] | GroupePersonnes[];
  groupes_interpretes_detail?: GroupePersonnes[];
  /** Lead vocal (chanteur principal). Si rempli, le reste devient accompagnement. */
  interprete_lead?: string | null;
  interprete_lead_detail?: Personne | null;
  /** UUID de l'événement liturgique (Veillée, Pâques…). Nullable. */
  evenement?: string | null;
  evenement_detail?: EvenementCantique | null;
  /** Cantique medley : enchaîne plusieurs sous-cantiques dans la même vidéo. */
  est_medley?: boolean;
  /** Sous-cantiques du medley avec leurs minutes (start/end). */
  passages?: CantiquePassage[];
  /** Libellé résolu : `interpretes_libelle` si saisi, sinon concat groupes + Personne. */
  interpretes_resolu?: string;
  duration: string;
  recording_type: string;
  recorded_at: string;
  date_enregistrement: string;
  pdf_url: string;
  audio_url: string;
  est_vedette: boolean;
  statut: StatutWorkflow;
  publie_le: string | null;
  supprime_le: string | null;
  nombre_vues: number;
  traductions: CantiqueTraduction[];
  occurrences?: CantiqueOccurrence[];
  cree_par: string | null;
  modifie_par: string | null;
  valide_par: string | null;
  cree_le: string;
  modifie_le: string;
}

export type ContentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "image"; src: string; alt?: string; size?: "small" | "medium" | "wide" }
  | { kind: "video"; url: string; caption?: string };

export interface AnnonceTraduction {
  langue: Lang;
  titre: string;
  titre_em: string;
  sous_type_label: string;
  description: string;
  date_display: string;
  dl: string;
  content_blocks: ContentBlock[];
}

export interface Annonce {
  id: string;
  slug: string;
  type: "reunion" | "voyage" | "sortie" | "exceptionnelle";
  sous_type: string;
  date_debut: string;
  date_fin: string | null;
  lieu: string;
  affiche: string | null;
  image: string | null;
  cta_url: string;
  est_phare: boolean;
  featured_eyebrow: string;
  featured_meta: { lbl: string; val: string }[];
  statut: StatutWorkflow;
  statut_temporel: StatutTemporel;
  publie_le: string | null;
  supprime_le: string | null;
  traductions: AnnonceTraduction[];
  cree_par: string | null;
  modifie_par: string | null;
  valide_par: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface TemoignageParagraph {
  kind: "lede" | "p" | "pull";
  text: string;
}

export interface TemoignageTraduction {
  langue: Lang;
  auteur: string;
  cite: string;
  quote_text: string;
  eyebrow: string;
  titre: string;
  corps: string;
  paragraphs: TemoignageParagraph[];
  byline: string;
  reading_minutes: number | null;
  tag: string;
  verset_ref: string;
  verset_text: string;
}

export interface TemoignagePhoto {
  id: string;
  image_url: string;
  legende: string;
  ordre: number;
  ajoutee_le: string;
}

export interface Temoignage {
  id: string;
  slug: string;
  type: "citation" | "illustre" | "recit";
  accent_rouge: boolean;
  image: string | null;
  /** Toggle admin : si false, l'image et les photos jointes ne sont PAS exposées
   * côté vitrine (le texte reste publié). True par défaut. */
  image_publique: boolean;
  has_detail: boolean;
  source: "admin" | "soumission_publique";
  date_recue: string;
  prenom_contact: string;
  nom_contact: string;
  email_contact: string;
  telephone_contact: string;
  ville_contact: string;
  texte_soumis: string;
  statut: StatutTemoignage;
  motif_rejet: string;
  publie_le: string | null;
  supprime_le: string | null;
  traductions: TemoignageTraduction[];
  photos: TemoignagePhoto[];
  cree_par: string | null;
  modifie_par: string | null;
  valide_par: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface Batisseur {
  id: string;
  initiales: string;
  engagement: string;
  ordre: number;
  actif: boolean;
}

export interface MontantContribution {
  id: string;
  valeur: string | null;
  label_fr: string;
  label_en: string;
  titre_fr: string;
  titre_en: string;
  description_fr: string;
  description_en: string;
  ordre: number;
  actif: boolean;
}

export interface ModeDon {
  id: string;
  code: string;
  icone: string;
  titre_fr: string;
  titre_en: string;
  instructions_fr: string;
  instructions_en: string;
  ordre: number;
  actif: boolean;
}

export interface ProjetNehemie {
  id: number;
  objectif: string;
  collecte: string;
  devise: string;
  mise_a_jour: string;
  pourcentage: number;
  modifie_le: string;
  /** Sous-collections actives, dénormalisées au GET. */
  batisseurs?: Batisseur[];
  montants?: MontantContribution[];
  modes_don?: ModeDon[];
}

// ─── Genèse ────────────────────────────────────────────────────────

export type GeneseBlockKind =
  | "paragraph"
  | "heading"
  | "quote"
  | "bibleRef"
  | "image"
  | "list"
  | "pull"
  | "signature";

export interface GeneseBlock {
  id: number;
  ordre: number;
  kind: GeneseBlockKind;
  content: string;
  level: number | null;
  source: string;
  reference: string;
  text: string;
  src: string;
  alt: string;
  caption: string;
  items: { auteur: string; recit: string }[];
}

export interface GenesePageTraduction {
  langue: Lang;
  titre: string;
  titre_em: string;
  eyebrow: string;
  sous_titre: string;
  blocs: GeneseBlock[];
}

export interface GenesePage {
  id: string;
  slug: string;
  type: "pilier" | "evenement";
  ordre: number;
  publie_le_editorial: string | null;
  traductions: GenesePageTraduction[];
  statut: StatutWorkflow;
  publie_le: string | null;
  supprime_le: string | null;
  cree_par: string | null;
  modifie_par: string | null;
  valide_par: string | null;
  cree_le: string;
  modifie_le: string;
}

// ─── Stats Témoignages ─────────────────────────────────────────────

export interface TemoignagesStats {
  total_affiche: number;
  premiere_annee: number;
  modifie_le: string;
}

export interface MotDuPasteur {
  texte_html_fr: string;
  texte_html_en: string;
  signature_fr: string;
  signature_en: string;
  modifie_le: string;
}

export interface Media {
  id: string;
  nom: string;
  url: string;
  variantes: { thumbnail: string | null; medium: string | null; full: string | null };
  alt: string;
  mime_type: string;
  taille_octets: number;
  largeur: number | null;
  hauteur: number | null;
  televerse_par: string | null;
  cree_le: string;
}

export interface RendezVous {
  id: string;
  jour: "mercredi" | "dimanche" | "vendredi";
  heure_debut: string;
  heure_fin: string;
  actif: boolean;
  traductions: { langue: Lang; titre: string; description: string }[];
}

export interface ImageSemaine {
  id: string;
  image: string | null;
  image_url: string | null;
  caption: string;
  caption_fr: string;
  caption_en: string;
  est_grande: boolean;
  ordre: number;
  semaine_iso: number;
  annee: number;
  actif: boolean;
}

export interface VlogSemaineTraduction {
  langue: Lang;
  titre_message: string;
  titre_suffix: string;
  pitch_message: string;
  serie: string;
  predicateur_libelle: string;
  verset_reference: string;
  verset_texte: string;
  fil_paragraphe1: string;
  fil_paragraphe2: string;
  fil_versets: string[];
  temoignage_auteur: string;
  temoignage_texte: string;
}

/** Détail dénormalisé du sermon référencé par le vlog (renvoyé en lecture publique). */
export interface VlogSemaineSermonDetail {
  id: string;
  slug: string;
  titre: string;
  youtube_url: string;
  thumbnail_url: string;
  audio_url: string;
  date_culte: string | null;
}

/** Détail dénormalisé du cantique-semaine référencé par le vlog. */
export interface VlogSemaineCantiqueDetail {
  id: string;
  slug: string;
  numero: string;
  titre: string;
  soliste: string;
  youtube_url: string;
  audio_url: string;
  vues_count: number;
  date_enregistrement: string;
}

export interface VlogSemaine {
  id: string;
  date_culte: string;
  heure_culte: string;
  sermon: string | null;
  /** Présent en lecture publique uniquement. */
  sermon_detail?: VlogSemaineSermonDetail | null;
  cantique_semaine: string | null;
  /** Présent en lecture publique uniquement. */
  cantique_semaine_detail?: VlogSemaineCantiqueDetail | null;
  poster: string | null;
  replay_url: string;
  statut: StatutWorkflow;
  publie_le: string | null;
  traductions: VlogSemaineTraduction[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

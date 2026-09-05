import { api, apiUrl } from "./client";
import type {
  Annonce,
  Batisseur,
  Cantique,
  CantiqueOccurrence,
  EvenementCantique,
  FamilleCantique,
  GenesePage,
  GroupePersonnes,
  ImageSemaine,
  Media,
  ModeDon,
  MontantContribution,
  MotDuPasteur,
  Paginated,
  Personne,
  ProjetNehemie,
  RendezVous,
  RolePersonne,
  Serie,
  SessionAdoration,
  SessionAdorationCantique,
  Temoignage,
  TemoignagesStats,
  TypeCulte,
  User,
  VlogSemaine,
} from "@/types";

export { api } from "./client";
export { HttpError } from "./client";
export { sermonsApi } from "./sermons";

export const typesCulteApi = {
  /** Lecture publique de la liste active (utilisée par la vitrine et les sélecteurs admin). */
  list: () => api.get<TypeCulte[]>("/sermons/types/"),
  /** Admin : tous les types, actifs ou non. */
  listAdmin: () => api.get<TypeCulte[]>("/sermons/types/admin/"),
  create: (body: Partial<TypeCulte>) =>
    api.post<TypeCulte>("/sermons/types/admin/", body),
  update: (code: string, body: Partial<TypeCulte>) =>
    api.patch<TypeCulte>(`/sermons/types/admin/${code}/`, body),
  remove: (code: string) => api.delete(`/sermons/types/admin/${code}/`),
};

export const famillesCantiqueApi = {
  list: () => api.get<FamilleCantique[]>("/cantiques/familles/"),
  listAdmin: () => api.get<FamilleCantique[]>("/cantiques/familles/admin/"),
  create: (body: Partial<FamilleCantique>) =>
    api.post<FamilleCantique>("/cantiques/familles/admin/", body),
  update: (code: string, body: Partial<FamilleCantique>) =>
    api.patch<FamilleCantique>(`/cantiques/familles/admin/${code}/`, body),
  remove: (code: string) => api.delete(`/cantiques/familles/admin/${code}/`),
};

interface ListFilters {
  q?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

const adminCrud = <T>(base: string) => ({
  list: (filters: ListFilters = {}) =>
    api.get<Paginated<T>>(base, { query: { ...filters, search: filters.q } }),
  get: (slug: string) => api.get<T>(`${base}${slug}/`),
  create: (body: Partial<T>) => api.post<T>(base, body),
  update: (slug: string, body: Partial<T>) => api.patch<T>(`${base}${slug}/`, body),
  remove: (slug: string) => api.delete(`${base}${slug}/`),
  soumettre: (slug: string) => api.post<T>(`${base}${slug}/soumettre/`),
  publier: (slug: string) => api.post<T>(`${base}${slug}/publier/`),
  rejeter: (slug: string) => api.post<T>(`${base}${slug}/rejeter/`),
  archiver: (slug: string) => api.post<T>(`${base}${slug}/archiver/`),
  desarchiver: (slug: string) => api.post<T>(`${base}${slug}/desarchiver/`),
});

export const cantiquesApi = adminCrud<Cantique>("/cantiques/admin/");
export const annoncesApi = {
  ...adminCrud<Annonce>("/annonces/admin/"),
  /** PATCH multipart pour attacher l'affiche officielle d'une annonce. */
  uploadAffiche: (slug: string, file: File) => {
    const form = new FormData();
    form.append("affiche", file);
    return api.patch<Annonce>(`/annonces/admin/${slug}/`, form, { multipart: true });
  },
  /** PATCH multipart pour l'image d'illustration générale (hors compte-rendu). */
  uploadImage: (slug: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.patch<Annonce>(`/annonces/admin/${slug}/`, form, { multipart: true });
  },
};

/** Occurrences vidéo d'un cantique (sous-ressource). */
export const cantiqueOccurrencesApi = {
  list: (cantiqueSlug: string) =>
    api.get<CantiqueOccurrence[]>(`/cantiques/admin/${cantiqueSlug}/occurrences/`),
  create: (cantiqueSlug: string, body: Partial<CantiqueOccurrence>) =>
    api.post<CantiqueOccurrence>(
      `/cantiques/admin/${cantiqueSlug}/occurrences/`,
      body,
    ),
  update: (cantiqueSlug: string, id: number, body: Partial<CantiqueOccurrence>) =>
    api.patch<CantiqueOccurrence>(
      `/cantiques/admin/${cantiqueSlug}/occurrences/${id}/`,
      body,
    ),
  remove: (cantiqueSlug: string, id: number) =>
    api.delete(`/cantiques/admin/${cantiqueSlug}/occurrences/${id}/`),
};

/** Sessions d'adoration (CRUD admin + workflow). */
export const sessionsAdorationApi = {
  ...adminCrud<SessionAdoration>("/sessions-adoration/admin/"),
  publicList: () => api.get<Paginated<SessionAdoration>>("/sessions-adoration/"),
  publicGet: (slug: string) =>
    api.get<SessionAdoration>(`/sessions-adoration/${slug}/`),
  cantiquesContenus: {
    list: (sessionSlug: string) =>
      api.get<SessionAdorationCantique[]>(
        `/sessions-adoration/admin/${sessionSlug}/cantiques/`,
      ),
    create: (sessionSlug: string, body: Partial<SessionAdorationCantique>) =>
      api.post<SessionAdorationCantique>(
        `/sessions-adoration/admin/${sessionSlug}/cantiques/`,
        body,
      ),
    update: (
      sessionSlug: string,
      id: number,
      body: Partial<SessionAdorationCantique>,
    ) =>
      api.patch<SessionAdorationCantique>(
        `/sessions-adoration/admin/${sessionSlug}/cantiques/${id}/`,
        body,
      ),
    remove: (sessionSlug: string, id: number) =>
      api.delete(`/sessions-adoration/admin/${sessionSlug}/cantiques/${id}/`),
  },
};

export const temoignagesApi = {
  list: (filters: ListFilters = {}) =>
    api.get<Paginated<Temoignage>>("/temoignages/admin/", {
      query: { ...filters, search: filters.q },
    }),
  get: (slug: string) => api.get<Temoignage>(`/temoignages/admin/${slug}/`),
  /** Création d'un témoignage en JSON (sans image principale). L'image éditoriale
   * peut être ajoutée ensuite via `uploadImage(slug, file)`. */
  create: (body: Partial<Temoignage>) =>
    api.post<Temoignage>("/temoignages/admin/", body),
  update: (slug: string, body: Partial<Temoignage>) =>
    api.patch<Temoignage>(`/temoignages/admin/${slug}/`, body),
  /** PATCH multipart pour attacher l'image principale (éditoriale). */
  uploadImage: (slug: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.patch<Temoignage>(`/temoignages/admin/${slug}/`, form, {
      multipart: true,
    });
  },
  approuver: (slug: string) =>
    api.post<Temoignage>(`/temoignages/admin/${slug}/approuver/`),
  rejeter: (slug: string, motif: string) =>
    api.post<Temoignage>(`/temoignages/admin/${slug}/rejeter/`, { motif }),
  marquerEnRevue: (slug: string) =>
    api.post<Temoignage>(`/temoignages/admin/${slug}/marquer_en_revue/`),
  /** URL HTML imprimable (à ouvrir dans un nouvel onglet, déclenche window.print). */
  printUrl: (slug: string) => apiUrl(`/temoignages/admin/${slug}/print/`),
  /** URL ZIP (texte + photos), prêt à partager via WhatsApp. */
  bundleUrl: (slug: string) => apiUrl(`/temoignages/admin/${slug}/bundle/`),
};

export const personnesApi = {
  list: (filters: ListFilters = {}) =>
    api.get<Paginated<Personne>>("/personnes/", { query: { ...filters, search: filters.q } }),
  get: (id: string) => api.get<Personne>(`/personnes/${id}/`),
  create: (body: Partial<Personne>) => api.post<Personne>("/personnes/", body),
  update: (id: string, body: Partial<Personne>) =>
    api.patch<Personne>(`/personnes/${id}/`, body),
  remove: (id: string) => api.delete(`/personnes/${id}/`),
};

/** Rôles éditables des Personnes (pasteur, chantre, diacre...). */
export const rolesPersonneApi = {
  list: () => api.get<RolePersonne[]>("/personnes/roles/"),
  listAdmin: () => api.get<RolePersonne[]>("/personnes/roles/admin/"),
  create: (body: Partial<RolePersonne>) =>
    api.post<RolePersonne>("/personnes/roles/admin/", body),
  update: (code: string, body: Partial<RolePersonne>) =>
    api.patch<RolePersonne>(`/personnes/roles/admin/${code}/`, body),
  remove: (code: string) => api.delete(`/personnes/roles/admin/${code}/`),
};

export const seriesApi = {
  list: () => api.get<Paginated<Serie>>("/personnes/series/"),
  get: (id: string) => api.get<Serie>(`/personnes/series/${id}/`),
  create: (body: Partial<Serie>) => api.post<Serie>("/personnes/series/", body),
  update: (id: string, body: Partial<Serie>) =>
    api.patch<Serie>(`/personnes/series/${id}/`, body),
  remove: (id: string) => api.delete(`/personnes/series/${id}/`),
};

/** Groupes de personnes (ex. « Chœurs »). M2M avec Personne. */
export const groupesPersonnesApi = {
  list: () => api.get<Paginated<GroupePersonnes>>("/personnes/groupes/"),
  get: (id: string) => api.get<GroupePersonnes>(`/personnes/groupes/${id}/`),
  create: (body: Partial<GroupePersonnes>) =>
    api.post<GroupePersonnes>("/personnes/groupes/", body),
  update: (id: string, body: Partial<GroupePersonnes>) =>
    api.patch<GroupePersonnes>(`/personnes/groupes/${id}/`, body),
  remove: (id: string) => api.delete(`/personnes/groupes/${id}/`),
};

/** Événements liturgiques (Veillée, Pâques…) qui regroupent des cantiques. */
export const evenementsCantiqueApi = {
  list: () => api.get<Paginated<EvenementCantique>>("/cantiques/evenements/"),
  get: (id: string) => api.get<EvenementCantique>(`/cantiques/evenements/${id}/`),
  create: (body: Partial<EvenementCantique>) =>
    api.post<EvenementCantique>("/cantiques/evenements/", body),
  update: (id: string, body: Partial<EvenementCantique>) =>
    api.patch<EvenementCantique>(`/cantiques/evenements/${id}/`, body),
  remove: (id: string) => api.delete(`/cantiques/evenements/${id}/`),
};

export const mediasApi = {
  list: (filters: ListFilters = {}) =>
    api.get<Paginated<Media>>("/medias/", { query: filters }),
  upload: (file: File, alt?: string) => {
    const fd = new FormData();
    fd.append("fichier", file);
    if (alt) fd.append("alt", alt);
    return api.post<Media>("/medias/upload/", fd, { multipart: true });
  },
  remove: (id: string) => api.delete(`/medias/${id}/`),
  utilisePar: (id: string) =>
    api.get<{ media_id: string; usages: { type: string; id: string; slug?: string }[] }>(
      `/medias/${id}/utilise-par/`,
    ),
};

export const nehemieApi = {
  get: () => api.get<ProjetNehemie>("/nehemie/"),
  update: (body: Partial<ProjetNehemie>) => api.put<ProjetNehemie>("/nehemie/", body),
  historique: () =>
    api.get<{
      history_date: string;
      objectif: string;
      collecte: string;
      mise_a_jour: string;
      history_user: string | null;
      history_type: string;
    }[]>("/nehemie/historique/"),
  batisseurs: {
    list: (params: { actif?: "true" | "false" } = {}) =>
      api.get<Batisseur[]>("/nehemie/batisseurs/", { query: params }),
    create: (body: Partial<Batisseur>) =>
      api.post<Batisseur>("/nehemie/batisseurs/", body),
    update: (id: string, body: Partial<Batisseur>) =>
      api.patch<Batisseur>(`/nehemie/batisseurs/${id}/`, body),
    remove: (id: string) => api.delete(`/nehemie/batisseurs/${id}/`),
  },
  montants: {
    list: () => api.get<MontantContribution[]>("/nehemie/montants/"),
    create: (body: Partial<MontantContribution>) =>
      api.post<MontantContribution>("/nehemie/montants/", body),
    update: (id: string, body: Partial<MontantContribution>) =>
      api.patch<MontantContribution>(`/nehemie/montants/${id}/`, body),
    remove: (id: string) => api.delete(`/nehemie/montants/${id}/`),
  },
  modesDon: {
    list: () => api.get<ModeDon[]>("/nehemie/modes-don/"),
    create: (body: Partial<ModeDon>) =>
      api.post<ModeDon>("/nehemie/modes-don/", body),
    update: (code: string, body: Partial<ModeDon>) =>
      api.patch<ModeDon>(`/nehemie/modes-don/${code}/`, body),
    remove: (code: string) => api.delete(`/nehemie/modes-don/${code}/`),
  },
};

/** Pages Genèse — 9 articles éditoriaux (CRUD admin + workflow). */
export const genesePagesApi = {
  ...adminCrud<GenesePage>("/genese/admin/"),
  publicList: () => api.get<GenesePage[]>("/genese/"),
  publicGet: (slug: string) => api.get<GenesePage>(`/genese/${slug}/`),
};

/** Compteurs éditoriaux Témoignages (singleton). */
export const temoignagesStatsApi = {
  get: () => api.get<TemoignagesStats>("/temoignages/stats/"),
  update: (body: Partial<TemoignagesStats>) =>
    api.put<TemoignagesStats>("/temoignages/stats/", body),
};

/** Mot du pasteur (singleton, HTML riche). */
export const motDuPasteurApi = {
  get: () => api.get<MotDuPasteur>("/mot-du-pasteur/"),
  update: (body: Partial<MotDuPasteur>) =>
    api.put<MotDuPasteur>("/mot-du-pasteur/", body),
};

export const semaineApi = {
  rendezVous: () => api.get<Paginated<RendezVous>>("/rendez-vous/"),
  imagesSemaine: () => api.get<Paginated<ImageSemaine>>("/images-semaine/"),
  /** Upload d'une nouvelle image (multipart). Renvoie l'objet créé. */
  imageCreate: (formData: FormData) =>
    api.post<ImageSemaine>("/images-semaine/", formData, { multipart: true }),
  /** PATCH partiel : captions, ordre, est_grande, actif. */
  imageUpdate: (id: string, body: Partial<ImageSemaine>) =>
    api.patch<ImageSemaine>(`/images-semaine/${id}/`, body),
  imageDelete: (id: string) => api.delete(`/images-semaine/${id}/`),
  /** Importe des Media existants vers la galerie de la semaine.
   *  Renvoie la liste des ImageSemaine créées (avec leurs URLs). */
  importFromMedia: (
    media_ids: string[],
    semaine_iso: number,
    annee: number,
    ordre_base: number,
  ) =>
    api.post<ImageSemaine[]>("/images-semaine/import-from-media/", {
      media_ids,
      semaine_iso,
      annee,
      ordre_base,
    }),
  vlogList: () => api.get<Paginated<VlogSemaine>>("/vlog-semaine/admin/"),
  vlogGet: (id: string) => api.get<VlogSemaine>(`/vlog-semaine/admin/${id}/`),
  vlogUpdate: (id: string, body: Partial<VlogSemaine>) =>
    api.patch<VlogSemaine>(`/vlog-semaine/admin/${id}/`, body),
};

export const accountsApi = {
  enable2fa: () =>
    api.post<{
      device_id: number;
      issuer: string;
      account: string;
      secret_b32: string;
      otpauth_url: string;
    }>("/auth/2fa/enable/"),
  verify2fa: (token: string) =>
    api.post<{ status: string; has_2fa: boolean }>("/auth/2fa/verify/", { token }),
  disable2fa: () =>
    api.post<{ status: string; has_2fa: boolean }>("/auth/2fa/disable/"),
  me: () => api.get<User>("/auth/me/"),
};

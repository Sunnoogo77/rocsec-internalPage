import { api } from "./client";
import type { Paginated, Sermon } from "@/types";

export interface SermonAdminFilters {
  q?: string;
  statut?: string;
  type_culte?: string;
  serie?: string;
  predicateur?: string;
  annee?: number;
  page?: number;
  page_size?: number;
  ordering?: string;
}

export const sermonsApi = {
  listAdmin: (filters: SermonAdminFilters = {}) =>
    api.get<Paginated<Sermon>>("/sermons/admin/", { query: { ...filters, search: filters.q } }),
  getAdmin: (slug: string) => api.get<Sermon>(`/sermons/admin/${slug}/`),
  create: (body: Partial<Sermon>) => api.post<Sermon>("/sermons/admin/", body),
  update: (slug: string, body: Partial<Sermon>) =>
    api.patch<Sermon>(`/sermons/admin/${slug}/`, body),
  remove: (slug: string) => api.delete(`/sermons/admin/${slug}/`),
  soumettre: (slug: string) => api.post<Sermon>(`/sermons/admin/${slug}/soumettre/`),
  publier: (slug: string) => api.post<Sermon>(`/sermons/admin/${slug}/publier/`),
  rejeter: (slug: string, motif: string) =>
    api.post<Sermon>(`/sermons/admin/${slug}/rejeter/`, { motif }),
  archiver: (slug: string) => api.post<Sermon>(`/sermons/admin/${slug}/archiver/`),
};

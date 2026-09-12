import { api, type RequestOptions } from "./client";
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
  update: (slug: string, body: Partial<Sermon>, options?: RequestOptions) =>
    api.patch<Sermon>(`/sermons/admin/${slug}/`, body, options),
  remove: (slug: string) => api.delete(`/sermons/admin/${slug}/`),
  soumettre: (slug: string, options?: RequestOptions) =>
    api.post<Sermon>(`/sermons/admin/${slug}/soumettre/`, undefined, options),
  publier: (slug: string, options?: RequestOptions) =>
    api.post<Sermon>(`/sermons/admin/${slug}/publier/`, undefined, options),
  rejeter: (slug: string, motif: string, options?: RequestOptions) =>
    api.post<Sermon>(`/sermons/admin/${slug}/rejeter/`, { motif }, options),
  archiver: (slug: string, options?: RequestOptions) =>
    api.post<Sermon>(`/sermons/admin/${slug}/archiver/`, undefined, options),
};

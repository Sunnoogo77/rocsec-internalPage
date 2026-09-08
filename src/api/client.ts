/**
 * Client API typé pour le backend RST.
 *
 * - Authentification par session Django (cookies HttpOnly + SameSite=Lax)
 * - CSRF : on lit le cookie `csrftoken` et on le renvoie en header X-CSRFToken
 *   pour toute requête mutante (POST/PUT/PATCH/DELETE).
 * - Format d'erreur standardisé selon PRD-ADMIN.md §5.8.
 */

import type { ApiError } from "@/types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

/** URL absolue d'une route API. Utile pour les téléchargements (a[href], window.open). */
export function apiUrl(path: string): string {
  return new URL(
    `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    window.location.origin,
  ).toString();
}

export class HttpError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let csrfToken: string | null = null;

function readCookie(name: string): string | null {
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const [key, ...rest] = c.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function buildHeaders(method: string, hasBody: boolean, extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra);
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    const csrf = csrfToken ?? readCookie("csrftoken");
    if (csrf) {
      headers.set("X-CSRFToken", csrf);
    }
  }
  return headers;
}

async function parseError(response: Response): Promise<HttpError> {
  let payload: ApiError | null = null;
  try {
    payload = (await response.json()) as ApiError;
  } catch {
    /* corps non-JSON — on construit un message par défaut */
  }
  return new HttpError(
    response.status,
    payload?.error?.code ?? "server_error",
    payload?.error?.message ?? (payload as unknown as { detail?: string })?.detail ?? `Erreur HTTP ${response.status}`,
    payload?.error?.details ?? payload as unknown as Record<string, unknown>,
  );
}

export interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  multipart?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  const isMultipart = Boolean(options.multipart);
  const hasBody = options.body !== undefined && method !== "GET" && method !== "HEAD";

  let body: BodyInit | undefined;
  if (hasBody) {
    if (isMultipart && options.body instanceof FormData) {
      body = options.body;
    } else {
      body = JSON.stringify(options.body);
    }
  }

  const init: RequestInit = {
    method,
    credentials: "include",
    headers: buildHeaders(method, hasBody && !isMultipart, options.headers),
    body,
    signal: options.signal,
  };

  const response = await fetch(url, init);
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),

  /** Récupère le cookie CSRF avant la première requête mutante de la session. */
  ensureCsrf: async () => {
    const result = await request<{ csrf: string }>("GET", "/auth/csrf/");
    csrfToken = result.csrf;
    return result;
  },
};

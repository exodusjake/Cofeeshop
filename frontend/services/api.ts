// Browser-side API client. All calls go to the same origin (/api/*): in dev Next proxies them, in production Nginx does.
// Authentication is an HttpOnly cookie, so no token ever touches JavaScript. State-changing calls carry a CSRF header.

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let csrf: string | null = null;
let csrfPending: Promise<string> | null = null;

export function resetCsrf() {
  csrf = null;
}

async function getCsrf(): Promise<string> {
  if (csrf) return csrf;
  csrfPending ??= fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" })
    .then((r) => r.json())
    .then((j) => (csrf = j.token as string))
    .finally(() => (csrfPending = null));
  return csrfPending;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = "Something went wrong. Please try again.";
  let code: string | undefined;
  try {
    const j = await res.json();
    if (j?.errors) message = Object.values(j.errors as Record<string, string[]>).flat().join(" ");
    else message = j?.title || j?.detail || message;
    code = j?.code;
  } catch {
    if (res.status === 429) message = "Too many requests. Please slow down and try again shortly.";
    if (res.status === 403) message = "You don't have permission to do that.";
    if (res.status === 401) message = "Please sign in to continue.";
  }
  return new ApiError(message, res.status, code);
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-TOKEN"] = await getCsrf();

  const res = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  // Token expired or rotated (e.g. after sign-in): fetch a fresh one and retry once.
  if (res.status === 400 && method !== "GET" && retry) {
    const text = await res.clone().text();
    if (text === "" || text.includes('"csrf"')) {
      resetCsrf();
      return request<T>(method, path, body, false);
    }
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("json") ? await res.json() : await res.text()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  del: <T = void>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<T>("POST", path, fd);
  },
};

export const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

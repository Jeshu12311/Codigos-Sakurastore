const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

let csrfToken: string | null = null;

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function messageFrom(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const value = data as Record<string, unknown>;
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error === 'string') return value.error;
    if (value.error && typeof value.error === 'object') {
      const nested = value.error as Record<string, unknown>;
      if (typeof nested.message === 'string') return nested.message;
    }
  }
  return fallback;
}

async function loadCsrf() {
  if (csrfToken) return csrfToken;
  const cookieToken = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrf_token='))
    ?.split('=')[1];
  if (cookieToken) {
    csrfToken = decodeURIComponent(cookieToken);
    return csrfToken;
  }
  return null;
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; csrf?: boolean };

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = options.csrf !== false && !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const token = needsCsrf ? await loadCsrf() : null;
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('X-CSRF-Token', token);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    credentials: 'include',
  });

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403 && needsCsrf) csrfToken = null;
    throw new ApiError(messageFrom(data, 'No se pudo completar la solicitud.'), response.status, data);
  }
  return data as T;
}

export function unwrapList<T>(response: T[] | { data?: T[]; items?: T[] }): T[] {
  if (Array.isArray(response)) return response;
  return response.items || response.data || [];
}

export function resetCsrf() {
  csrfToken = null;
}

export function setCsrf(token?: string) {
  csrfToken = token || null;
}

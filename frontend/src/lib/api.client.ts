/**
 * Central fetch wrapper for the RecruitHUB REST API.
 * Reads JWT from localStorage and attaches it as Bearer token on every request.
 * All service files import `api` from here instead of using supabase directly.
 *
 * Logger: every request prints  [METHOD] /path  →  STATUS  (Xms)
 *         errors print a full breakdown so they're easy to diagnose.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'recruithub_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  total?: number;
  page?: number;
  limit?: number;
}

// ─── Logger helpers ────────────────────────────────────────────────────────────
const LOG_STYLE = {
  method:  'color:#7dd3fc;font-weight:600',   // blue
  path:    'color:#e2e8f0',
  ok:      'color:#4ade80;font-weight:600',   // green
  warn:    'color:#facc15;font-weight:600',   // yellow
  err:     'color:#f87171;font-weight:600',   // red
  dim:     'color:#64748b',
};

function logRequest(method: string, path: string, status: number, ms: number, error?: string) {
  const isOk  = status >= 200 && status < 300;
  const isWarn = status >= 400 && status < 500;
  const isErr  = status >= 500 || status === 0;

  const statusStyle = isOk ? LOG_STYLE.ok : isWarn ? LOG_STYLE.warn : LOG_STYLE.err;
  const statusText  = status === 0 ? 'NETWORK ERROR' : String(status);

  console.groupCollapsed(
    `%c${method}%c ${path} %c${statusText}%c ${ms}ms`,
    LOG_STYLE.method, LOG_STYLE.path, statusStyle, LOG_STYLE.dim,
  );
  console.log('%cURL', LOG_STYLE.dim, `${BASE_URL}${path}`);
  if (error) {
    console.error('%cError', LOG_STYLE.err, error);
  }
  console.groupEnd();
}

// ─── Core request ──────────────────────────────────────────────────────────────
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const start = performance.now();
  let status  = 0;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    status = res.status;
    const ms = Math.round(performance.now() - start);

    // Handle expired JWT — clear token and redirect to login
    if (res.status === 401) {
      logRequest(method, path, status, ms, 'Session expired — redirecting to login');
      const existingToken = getToken();
      if (existingToken) {
        clearToken();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
    }

    const json: ApiResponse<T> = await res.json();

    if (!res.ok || !json.success) {
      const errMsg = json.error || `Request failed with status ${res.status}`;
      logRequest(method, path, status, ms, errMsg);
      throw new Error(errMsg);
    }

    logRequest(method, path, status, ms);
    return json;

  } catch (err: any) {
    const ms = Math.round(performance.now() - start);

    // Network-level failure (offline, CORS, DNS, etc.)
    if (status === 0) {
      const networkMsg = `Cannot reach the server at ${BASE_URL}. Check that the backend is running and CORS is configured.`;
      logRequest(method, path, 0, ms, networkMsg);
      throw new Error('Server unreachable. Please check your connection or contact support.');
    }

    // Re-throw errors already thrown above (401, api errors)
    throw err;
  }
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};

import type { ErrorResponse } from './types';

/** Header every state-changing request must carry (backend OriginGuard). */
const CSRF_HEADER = 'x-authdrop-csrf';
const API_PREFIX = '/api';

/** A non-2xx response, carrying the backend error shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly messages: string[];
  readonly requestId: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, body: Partial<ErrorResponse> | null, fallback: string) {
    const messages = normaliseMessages(body?.message);
    super(messages[0] ?? fallback);
    this.name = 'ApiError';
    this.status = status;
    this.error = body?.error ?? 'Error';
    this.messages = messages.length > 0 ? messages : [fallback];
    this.requestId = body?.requestId;
    this.retryAfterSeconds = body?.retryAfterSeconds;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function normaliseMessages(m: string[] | string | undefined): string[] {
  if (Array.isArray(m)) return m.filter((x): x is string => typeof x === 'string');
  return typeof m === 'string' ? [m] : [];
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Subscribe to "a call that needs a session got 401". Returns an unsubscribe function. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
  /** Do not broadcast 401 as "session expired" (used for the session probe and public steps). */
  quiet401?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_PREFIX}${path}`;
  if (!query) return url;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const qs = sp.toString();
  return qs ? `${url}?${qs}` : url;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET') headers[CSRF_HEADER] = '1';

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body, credentials: 'same-origin', signal: opts.signal ?? null });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, null, 'Cannot reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    let parsed: Partial<ErrorResponse> | null = null;
    try {
      parsed = (await res.json()) as Partial<ErrorResponse>;
    } catch {
      parsed = null;
    }
    const err = new ApiError(res.status, parsed, `Request failed (${res.status})`);
    if (res.status === 401 && !opts.quiet401) unauthorizedListeners.forEach((l) => l());
    throw err;
  }
  return res;
}

/** JSON request. 204 / empty bodies resolve to `undefined`. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : undefined) as T;
}

/** Binary / file request (e.g. data export). */
export async function apiBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  const res = await send(path, opts);
  return res.blob();
}

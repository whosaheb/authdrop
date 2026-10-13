import { SocialAuthError } from '../social.errors.js';

const TIMEOUT_MS = 10_000;

/** fetch with a hard timeout, JSON parsing and uniform error mapping (no upstream bodies leak into errors). */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
    });
  } catch (error) {
    throw new SocialAuthError(`Request to ${new URL(url).host} failed: ${(error as Error).message}`);
  }
  if (!response.ok) throw new SocialAuthError(`${new URL(url).host} responded with HTTP ${response.status}`);
  try {
    return (await response.json()) as T;
  } catch {
    throw new SocialAuthError(`${new URL(url).host} returned a non-JSON response`);
  }
}

export const formBody = (fields: Record<string, string>): URLSearchParams => new URLSearchParams(fields);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Redirect URI policy for registered clients (OAuth 2.0 Security BCP):
 * absolute, https (http only for loopback development), no fragment, no credentials, no wildcards.
 * Returns an error message, or null when the URI is acceptable.
 */
export function redirectUriProblem(value: string): string | null {
  if (value.length > 2048) return 'is too long';
  if (value.includes('*')) return 'must not contain wildcards';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'must be an absolute URL';
  }
  if (url.hash) return 'must not contain a fragment';
  if (url.username || url.password) return 'must not contain credentials';
  if (url.protocol === 'https:') return null;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return null;
  return 'must use https (http is allowed for localhost only)';
}

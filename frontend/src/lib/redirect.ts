/**
 * Safe handling of redirect targets.
 *
 * Targets are only ever taken from a backend response body (`redirectTo`), never from the query string.
 * A relative portal path is handled by the router; an absolute URL (resuming a relying-party flow) is
 * handled by a full navigation. Anything else (javascript:, data:, protocol-relative, backslash tricks) is rejected.
 */
export type RedirectTarget = { kind: 'internal'; path: string } | { kind: 'external'; url: string };

export function classifyRedirect(target: string | null | undefined, origin: string): RedirectTarget | null {
  if (!target) return null;
  if (/[\u0000-\u001f\\]/.test(target)) return null; // control chars / backslashes, checked BEFORE trimming
  const t = target.trim();
  if (!t) return null;

  if (t.startsWith('/')) {
    if (t.startsWith('//')) return null; // protocol-relative: points to another host
    return { kind: 'internal', path: t };
  }

  let url: URL;
  try {
    url = new URL(t);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (url.origin === origin) return { kind: 'internal', path: `${url.pathname}${url.search}${url.hash}` };
  return { kind: 'external', url: url.toString() };
}

export type Navigator = (path: string, opts?: { replace?: boolean }) => void;

/** Follow a backend-provided redirect. Returns false when the target was rejected. */
export function followRedirect(target: string | null | undefined, navigate: Navigator, assign: (url: string) => void = (u) => window.location.assign(u)): boolean {
  const classified = classifyRedirect(target, window.location.origin);
  if (!classified) return false;
  if (classified.kind === 'internal') navigate(classified.path, { replace: true });
  else assign(classified.url);
  return true;
}

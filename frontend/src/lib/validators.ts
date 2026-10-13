/** Client-side mirrors of the backend validators. The server stays the source of truth. */

const UID_PATTERN = /^[\w-]{10,64}$/;
const NAME_PATTERN = /^[^<>\u0000-\u001f\u007f]+$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Only accept an interaction id of the exact backend shape; anything else is dropped. */
export function parseUid(raw: string | null | undefined): string | undefined {
  return raw && UID_PATTERN.test(raw) ? raw : undefined;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function emailProblem(value: string): string | null {
  const v = normalizeEmail(value);
  if (!v) return 'Enter your email address.';
  if (v.length > 254) return 'That email address is too long.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address, like name@example.com.';
  return null;
}

export function nameProblem(label: string, value: string): string | null {
  const v = value.trim();
  if (!v) return `Enter your ${label}.`;
  if (v.length > 80) return `${capitalise(label)} must be 80 characters or fewer.`;
  if (!NAME_PATTERN.test(v)) return `${capitalise(label)} contains characters that are not allowed.`;
  return null;
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isSixDigits(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/** Digits only, at most 6 (for typing and pasting into the OTP field). */
export function sanitiseOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function backupCodeProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter one of your recovery codes.';
  if (!/^[A-Za-z0-9\s-]{10,12}$/.test(v)) return 'Recovery codes look like ABCDE-FGH23.';
  return null;
}

/** Mirrors backend redirectUriProblem (common/helpers/uri.helper.ts). */
export function redirectUriProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter a URL.';
  if (v.length > 2048) return 'is too long';
  if (v.includes('*')) return 'Wildcards are not allowed.';
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return 'Enter an absolute URL, like https://app.example.com/callback.';
  }
  if (url.hash) return 'Remove the #fragment.';
  if (url.username || url.password) return 'Remove credentials from the URL.';
  if (url.protocol === 'https:') return null;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return null;
  return 'Use https (http is only allowed for localhost).';
}

export function clientNameProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Give your app a name.';
  if (v.length > 60) return 'Name must be 60 characters or fewer.';
  if (/[<>\u0000-\u001f]/.test(v)) return 'Name contains characters that are not allowed.';
  return null;
}

/** Validates a redirect URI list; returns a per-row problem array and a list-level problem. */
export function redirectUriListProblems(values: string[], max = 10): { rows: (string | null)[]; list: string | null } {
  const trimmed = values.map((v) => v.trim());
  const rows = trimmed.map((v, i) => {
    const p = redirectUriProblem(v);
    if (p) return p;
    return trimmed.indexOf(v) !== i ? 'Duplicate URL.' : null;
  });
  let list: string | null = null;
  if (trimmed.length === 0) list = 'Add at least one redirect URI.';
  else if (trimmed.length > max) list = `You can register up to ${max} redirect URIs.`;
  return { rows, list };
}

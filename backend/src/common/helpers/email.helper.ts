/** Canonical form used for every lookup and every stored address. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Masks an address for logs / UI hints: j***@example.com */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

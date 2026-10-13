import { escapeHtml } from '../../../common/helpers/email.helper.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Minimal, client-safe (table-free, inline-styled) transactional layout. */
export function renderLayout(params: { preheader: string; heading: string; bodyHtml: string; footer?: string }): string {
  const footer = params.footer ?? 'You received this email because of activity on your AuthDrop account.';
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14171f">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(params.preheader)}</span>
<div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e6eb">
  <div style="font-weight:700;font-size:18px;letter-spacing:.2px;margin-bottom:20px">AuthDrop</div>
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(params.heading)}</h1>
  ${params.bodyHtml}
  <p style="margin-top:28px;font-size:12px;color:#6b7280">${escapeHtml(footer)}</p>
</div></body></html>`;
}

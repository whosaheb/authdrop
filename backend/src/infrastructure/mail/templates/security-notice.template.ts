import { escapeHtml } from '../../../common/helpers/email.helper.js';
import { type RenderedEmail, renderLayout } from './layout.js';

/** Notifies users about security-relevant changes (SOC 2 CC6.1 / user notification). */
export function renderSecurityNotice(params: { subject: string; heading: string; message: string }): RenderedEmail {
  const html = renderLayout({
    preheader: params.heading,
    heading: params.heading,
    bodyHtml: `<p style="margin:0;line-height:1.5">${escapeHtml(params.message)}</p>
      <p style="margin:16px 0 0;line-height:1.5;color:#6b7280;font-size:14px">If this was not you, sign in and review your account security settings immediately.</p>`,
  });
  return { subject: params.subject, html, text: `${params.heading}\n\n${params.message}\n\nIf this was not you, review your account security settings immediately.` };
}

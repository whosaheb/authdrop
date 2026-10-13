import { escapeHtml } from '../../../common/helpers/email.helper.js';
import { type RenderedEmail, renderLayout } from './layout.js';

export type OtpPurpose = 'login' | 'register';

export function renderOtpEmail(params: { code: string; purpose: OtpPurpose; ttlMinutes: number }): RenderedEmail {
  const action = params.purpose === 'register' ? 'create your AuthDrop account' : 'sign in to AuthDrop';
  const subject = `${params.code} is your AuthDrop verification code`;
  const html = renderLayout({
    preheader: `Use ${params.code} to ${action}`,
    heading: 'Your verification code',
    bodyHtml: `
      <p style="margin:0 0 16px;line-height:1.5">Use this code to ${escapeHtml(action)}. It expires in ${params.ttlMinutes} minutes and can be used once.</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,Menlo,Consolas,monospace;background:#f4f5f7;border-radius:8px;padding:16px;text-align:center">${escapeHtml(params.code)}</div>
      <p style="margin:16px 0 0;line-height:1.5;color:#6b7280;font-size:14px">If you did not request this code, you can safely ignore this email. Never share it with anyone - AuthDrop will never ask for it.</p>`,
  });
  const text = `Your AuthDrop verification code is ${params.code}.\nUse it to ${action}. It expires in ${params.ttlMinutes} minutes.\nIf you did not request it, ignore this email and never share the code.`;
  return { subject, html, text };
}

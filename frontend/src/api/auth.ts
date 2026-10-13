import { api } from './client';
import type {
  AuthStepResponse,
  InteractionDetails,
  InteractionResult,
  MessageResponse,
  NameFields,
  OtpRequestBody,
  OtpVerifyBody,
  SecondFactor,
  SessionState,
} from './types';

const uidPath = (uid: string): string => `/auth/interactions/${encodeURIComponent(uid)}`;

export const authApi = {
  session: (signal?: AbortSignal) => api<SessionState>('/auth/session', { quiet401: true, ...(signal ? { signal } : {}) }),
  requestOtp: (body: OtpRequestBody) => api<MessageResponse>('/auth/otp/request', { method: 'POST', body, quiet401: true }),
  verifyOtp: (body: OtpVerifyBody) => api<AuthStepResponse>('/auth/otp/verify', { method: 'POST', body, quiet401: true }),
  verifyMfa: (body: SecondFactor) => api<AuthStepResponse>('/auth/mfa/verify', { method: 'POST', body, quiet401: true }),
  registerProfile: (body: NameFields) => api<AuthStepResponse>('/auth/register/profile', { method: 'POST', body, quiet401: true }),
  completeRegistration: () => api<AuthStepResponse>('/auth/register/complete', { method: 'POST' }),
  logout: () => api<void>('/auth/logout', { method: 'POST', quiet401: true }),
  interaction: (uid: string) => api<InteractionDetails>(uidPath(uid), { quiet401: true }),
  continueInteraction: (uid: string) => api<InteractionResult>(`${uidPath(uid)}/continue`, { method: 'POST' }),
  decideConsent: (uid: string, approve: boolean) => api<InteractionResult>(`${uidPath(uid)}/consent`, { method: 'POST', body: { approve } }),
};

export function socialStartUrl(provider: string, uid?: string): string {
  const base = `/api/auth/social/${encodeURIComponent(provider)}/start`;
  return uid ? `${base}?uid=${encodeURIComponent(uid)}` : base;
}

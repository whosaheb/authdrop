import { api } from './client';
import type { BackupCodes, MfaStatus, SecondFactor, TotpSetup } from './types';

export const mfaApi = {
  status: () => api<MfaStatus>('/mfa/status'),
  setup: () => api<TotpSetup>('/mfa/totp/setup', { method: 'POST' }),
  enable: (code: string) => api<BackupCodes>('/mfa/totp/enable', { method: 'POST', body: { code } }),
  disable: (body: SecondFactor) => api<void>('/mfa/totp/disable', { method: 'POST', body }),
  regenerateBackupCodes: (body: SecondFactor) => api<BackupCodes>('/mfa/backup-codes/regenerate', { method: 'POST', body }),
};

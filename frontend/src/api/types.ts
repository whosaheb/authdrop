/** Types mirroring the AuthDrop backend DTOs (src/modules/**\/dto). */

export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type UserRole = 'USER' | 'DEVELOPER' | 'ADMIN';
export type ClientType = 'PUBLIC' | 'CONFIDENTIAL';
export type TokenEndpointAuthMethod = 'CLIENT_SECRET_BASIC' | 'CLIENT_SECRET_POST' | 'NONE' | (string & {});

/** Shape of every non-2xx response (ErrorResponseDto). */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string[] | string;
  requestId?: string;
  timestamp?: string;
  path?: string;
  retryAfterSeconds?: number;
}

export interface MessageResponse {
  message: string;
}

// ── auth ──
export type AuthStatus = 'authenticated' | 'mfa_required' | 'profile_required' | 'profile_created';

export interface AuthStepResponse {
  status: AuthStatus;
  redirectTo: string | null;
}

export type PreauthStep = 'mfa' | 'profile' | 'security_setup';

export interface PreauthState {
  step: PreauthStep;
  maskedEmail?: string;
  firstName?: string;
  lastName?: string;
}

export interface SocialProviderInfo {
  id: string;
  name: string;
}

export interface LinkedProvider {
  provider: string;
  linkedAt: string;
}

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  role: UserRole;
  totpEnabled: boolean;
  linkedProviders: LinkedProvider[];
  avatarUploadEnabled: boolean;
  createdAt: string;
}

export interface SessionState {
  authenticated: boolean;
  user?: User;
  preauth?: PreauthState;
  providers: SocialProviderInfo[];
}

export interface InteractionDetails {
  uid: string;
  prompt: 'login' | 'consent' | (string & {});
  clientName: string;
  scopes: string[];
  forceReauth: boolean;
}

export interface InteractionResult {
  status: 'redirect' | 'consent_required';
  redirectTo: string | null;
}

export interface OtpRequestBody {
  email: string;
  uid?: string;
}
export interface OtpVerifyBody extends OtpRequestBody {
  code: string;
}
export interface NameFields {
  firstName: string;
  lastName: string;
}

// ── users ──
export interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  gender?: Gender | null;
  dateOfBirth?: string | null;
}

// ── mfa ──
export interface SecondFactor {
  code?: string;
  backupCode?: string;
}
export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
}
export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}
export interface BackupCodes {
  codes: string[];
}

// ── sessions / apps ──
export interface PortalSession {
  ref: string;
  current: boolean;
  ip: string;
  userAgent: string;
  amr: string[];
  createdAt: string;
  lastSeenAt: string;
}
export interface ConnectedApp {
  clientId: string;
  name: string;
  scopes: string[];
  authorizedAt: string;
}
export interface RevokedCount {
  revoked: number;
}

// ── developer ──
export interface Client {
  clientId: string;
  name: string;
  clientType: ClientType;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  createdAt: string;
  updatedAt: string;
}
export interface ClientCredentials extends Client {
  clientSecret: string | null;
}
export interface CreateClientBody {
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  clientType?: ClientType;
  tokenEndpointAuthMethod?: 'CLIENT_SECRET_BASIC' | 'CLIENT_SECRET_POST';
}
export interface UpdateClientBody {
  name?: string;
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
}
export interface ClientLogEntry {
  id: string;
  occurredAt: string;
  event: string;
  outcome: 'SUCCESS' | 'FAILURE' | (string & {});
  sub: string | null;
}
export interface ClientLogsPage {
  items: ClientLogEntry[];
  nextCursor: string | null;
}
export interface DailyMetric {
  day: string;
  event: string;
  count: number;
}
export interface ClientMetrics {
  activeUsers: number;
  windowDays: number;
  daily: DailyMetric[];
}

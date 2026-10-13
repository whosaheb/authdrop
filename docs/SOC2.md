# SOC 2 readiness

> SOC 2 is an audit of an organisation's controls over time (Security, Availability, Confidentiality, Processing Integrity, Privacy), not a property of source code. This codebase implements the **technical controls** an auditor will look for and produces the evidence; policies, vendor management, HR, incident response and the audit itself remain your organisation's work.

## Technical control mapping

| TSC | Control | Implementation |
| --- | --- | --- |
| CC6.1 Logical access | Passwordless auth, optional TOTP MFA, single-use backup codes, RBAC (`USER`/`DEVELOPER`/`ADMIN`) | `modules/auth-core`, `modules/mfa`, `common/guards/{session,roles}.guard.ts` |
| CC6.1 Credential storage | No passwords. OTPs and backup codes stored as HMAC-SHA-256 (server pepper); TOTP and OIDC client secrets AES-256-GCM encrypted; TOTP step replay blocked | `common/crypto`, `common/helpers` |
| CC6.1 Session mgmt | Opaque 256-bit session ids in Redis (hashed), idle + absolute timeouts, per-device list, revoke one/all | `auth-core/session.service.ts`, `modules/sessions` |
| CC6.2/6.3 Provisioning | Role changes audited; developer self-enrolment can be switched off (`DEVELOPER_SELF_ENROLL`); `user:promote` script for admins | `modules/developer`, `scripts/promote-user.ts` |
| CC6.6 Boundary protection | Strict CSP/HSTS/frame-deny (Helmet + nginx), Origin + custom-header CSRF guard, PKCE-only OIDC, redirect-URI validation (HTTPS, no wildcards) | `main.ts`, `common/guards/origin.guard.ts`, `common/validators` |
| CC6.7 Data in transit | HSTS in production, `Secure` cookies, TLS terminated in front (`TRUST_PROXY`) | `main.ts`, `config` |
| CC6.8 / CC7.1 Abuse prevention | Redis rate limits per IP/e-mail/user on every sensitive route; OTP attempt cap + resend cooldown; uniform responses (no account enumeration) | `common/guards/rate-limit.guard.ts`, `auth-core/otp.service.ts` |
| CC7.2 Monitoring | Structured JSON logs with key-based secret redaction and per-request ids; security events written to the audit log | `common/logging`, `modules/audit` |
| CC7.2 / CC7.3 Audit trail | Append-only `audit_logs` (DB triggers forbid UPDATE/TRUNCATE) with a SHA-256 hash chain; `GET /api/admin/audit/verify` detects tampering | `prisma/migrations`, `audit.service.ts` |
| CC8.1 Change management | CI: typecheck, tests, build, `npm audit` = 0 failure gate, Trivy image scan, Dependabot, exact-pinned dependencies, SQL migrations in version control | `.github/` |
| A1.2 Availability | `/api/health/live` and `/ready` (DB + Redis), container HEALTHCHECK, graceful shutdown, stateless API (horizontally scalable) | `modules/health` |
| C1.1/C1.2 Confidentiality & disposal | Retention job prunes audit rows (`AUDIT_RETENTION_DAYS`) and expired grants; `no-store` on API responses; avatars re-encoded with metadata stripped | `audit/retention.service.ts`, `storage` |
| P-series Privacy | Data minimisation (provider tokens not stored), user data export (`GET /api/users/me/export`), self-service account deletion, masked e-mails in pre-auth state | `modules/users` |

## Configuration baseline for production

* `NODE_ENV=production`, `TRUST_PROXY=true`, TLS in front, `APP_URL` = the public HTTPS origin.
* Generate all secrets with `npm run keys:generate`; store them in a secret manager, never in the repo. Rotate `ENCRYPTION_KEY`/`HMAC_PEPPER`/cookie keys on a schedule you document.
* `SESSION_IDLE_TTL_SECONDS=28800`, `SESSION_ABSOLUTE_TTL_SECONDS=604800` (example defaults; tighten per policy).
* `SWAGGER_ENABLED=false` on public deployments (or restrict `/api/docs` at the proxy).
* Managed PostgreSQL with encryption at rest, PITR backups, restricted network access; Redis with auth + TLS.
* Ship stdout logs to a SIEM with retention ≥ your audit period; alert on repeated `auth.otp.verify_failed`.
* Consider requiring MFA for `ADMIN`/`DEVELOPER` roles via policy and monitor via audit events.

## Verification performed on this codebase

Against a real PostgreSQL + Redis: sign-up OTP flow, session, developer enrolment, client creation, `/authorize` → interaction → code, token exchange with PKCE, ID-token nonce/audience, userinfo, authorization-code replay rejection (revokes the grant), PKCE-required enforcement, connected-app revocation (tokens die), logout, CSRF/origin and missing-header blocking, unauthenticated access blocked, TOTP enrolment + MFA login + backup-code single use, hash-chained audit events recorded. `npm audit`: 0 vulnerabilities in both apps.

## What an auditor will still ask for (not in code)

Information-security and access-review policies, risk assessment, vendor reviews (cloud, SMTP, R2), incident-response and breach-notification runbooks, backup/restore tests, background checks and training records, evidence of CI/branch-protection settings and periodic access reviews.

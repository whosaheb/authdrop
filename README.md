# AuthDrop

Self-hosted **passwordless OpenID Connect identity provider**. Users sign in with an e-mail one-time code (or an optional social account), can add authenticator-app MFA, and developers register OIDC clients in a console.

| Part | Stack |
| --- | --- |
| `backend/` | Node 24 LTS, NestJS 12 + Fastify 5, `oidc-provider` 9, Prisma 7 + PostgreSQL, Redis, Nodemailer, Cloudflare R2, Swagger |
| `frontend/` | React 19 + Vite 8 + TypeScript (login, profile wizard, account settings, developer console) |

SPA, REST API (`/api`) and OIDC provider (`/oauth`) are served from **one public origin** (Vite proxy in dev, nginx in Docker). That is what lets the HttpOnly `authdrop_session` cookie and the OIDC interaction work without CORS.

## Quick start (development)

Requirements: Node 24 (`.nvmrc`; ≥ 22.18 works), Docker for Postgres/Redis/Mailpit.

```bash
docker compose up -d                        # postgres, redis, mailpit (OTP e-mails at http://localhost:8025)

cd backend
cp .env.example .env
npm ci
npm run keys:generate                       # prints secrets, writes secrets/jwks.json: paste output into .env
npx prisma migrate deploy
npm run start:dev                           # API on :3000, Swagger on http://localhost:3000/api/docs

cd ../frontend
npm ci
npm run dev                                 # http://localhost:5173  (proxies /api and /oauth to :3000)
```

`APP_URL` in `backend/.env` must equal the origin you open in the browser (`http://localhost:5173` in dev).

Make yourself the first admin: sign in once, then `npm run user:promote -- you@example.com ADMIN`. Any signed-in user can enrol as a developer from `/developer/console` (`DEVELOPER_SELF_ENROLL=true`).

Full stack in containers (web on `:8080`): `docker compose --profile app up -d --build`, with `APP_URL=http://localhost:8080`.

## Flows

1. An app sends the browser to `/oauth/authorize?...&code_challenge=...` (PKCE is mandatory).
2. No SSO session → the provider pauses, redirects to `/login?uid=…`. An existing `authdrop_session` resumes silently.
3. The user enters an e-mail → 6-digit code → (MFA if enabled) → back to the app with an authorization code. New users complete a name step and an optional authenticator-app step with backup codes.
4. **Social login** (Google, GitHub, Facebook, LinkedIn) is an *additional* way to reach step 3. It only proves the e-mail; MFA, profile completion, consent and the OIDC resume are identical. See [docs/SOCIAL_LOGIN.md](docs/SOCIAL_LOGIN.md).
5. The app exchanges the code at `/oauth/token`; discovery is at `/oauth/.well-known/openid-configuration`.

## Layout

```
backend/src
  common/        decorators, guards (session, roles, origin/CSRF, rate-limit), filters, crypto + helpers, validators
  config/        env validation (fails fast), typed AppConfig, JWKS loader
  infrastructure/ prisma, redis, mail (templates), storage (R2 + image re-encoding)
  modules/       auth-core (sessions, OTP, pre-auth), auth, social, mfa, users, sessions, oidc (provider factory,
                 adapters, interactions, consent), developer (clients), audit (hash-chained log, retention), health
backend/prisma   schema + SQL migrations (audit table is append-only via DB triggers)
frontend/src     app, api (typed client), components/ui, features/{auth,register,consent,account,developer}, hooks, lib
```

## Security & compliance

* Dependency policy: current LTS runtimes, exact-pinned versions, `npm audit` = 0 in both apps, enforced in CI (`.github/workflows/ci.yml`) and weekly.
* SOC 2 control mapping, configuration baseline and the organisational work an audit still needs: [docs/SOC2.md](docs/SOC2.md).
* Verified end to end (see "Verification" in docs/SOC2.md): registration, OTP, MFA, backup codes, auth-code + PKCE flow, token/userinfo, code-replay rejection, connected-app revocation, CSRF/origin blocking.

## Not done / needs your input

* Social login needs your OAuth app credentials; it compiles and is wired into the verified OIDC flow, but it has not been run against the live providers. Unlinking a provider is not implemented yet.
* Cloudflare R2 avatar upload needs real R2 credentials (uploads are disabled when unset).
* The Docker/Compose files and GitHub Actions workflow were written but could not be run in the build sandbox (no Docker daemon).

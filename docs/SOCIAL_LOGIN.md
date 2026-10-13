# Social login

Providers: **Google, GitHub, Facebook, LinkedIn**. A provider is enabled only when both its `*_CLIENT_ID` and `*_CLIENT_SECRET` are set; the login page shows only enabled providers (`GET /api/auth/session` → `providers`).

Register this callback URL at each provider: `{APP_URL}/api/auth/social/{google|github|facebook|linkedin}/callback`

## How it fits the passwordless backbone

Social sign-in is just another proof of "this person controls this verified e-mail", like the e-mail code. After the provider callback the flow rejoins the normal pipeline:

| Situation | Result |
| --- | --- |
| Known social identity | Same as a successful OTP for that user |
| Unknown identity, **provider-verified** e-mail matches an existing user | Identity is linked (audited), then normal login |
| Unknown identity, new e-mail | Pre-auth state → profile step (name pre-filled) → optional MFA → session |
| User has MFA enabled | MFA is still required after social login |
| Provider gives no verified e-mail | Rejected: never trust unverified e-mails (prevents account pre-hijacking) |

Other properties: state + PKCE where supported, `authdrop_oauth_state` HttpOnly cookie binds the callback to the starting browser, provider tokens are **not stored**, linked providers are listed in Settings → Security (there is no unlink endpoint yet; the e-mail code always remains available, so there is no lock-out risk), and the OIDC `uid` survives the round trip so the relying-party flow resumes correctly.

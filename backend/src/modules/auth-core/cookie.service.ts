import '@fastify/cookie';
import { Injectable } from '@nestjs/common';
import { type FastifyReply } from 'fastify';
import { AppConfig } from '../../config/app-config.service.js';
import { OAUTH_STATE_COOKIE, PREAUTH_COOKIE, SESSION_COOKIE } from '../../common/constants/cookies.js';

/** Single place that decides cookie attributes. Everything is HttpOnly + SameSite=Lax (+ Secure over HTTPS). */
@Injectable()
export class CookieService {
  constructor(private readonly config: AppConfig) {}

  private base(path: string, maxAgeSeconds: number) {
    return {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax' as const,
      path,
      maxAge: maxAgeSeconds,
    };
  }

  setSession(reply: FastifyReply, sessionId: string): void {
    void reply.setCookie(SESSION_COOKIE, sessionId, this.base('/', this.config.session.absoluteTtlSeconds));
  }

  clearSession(reply: FastifyReply): void {
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  setPreauth(reply: FastifyReply, token: string): void {
    void reply.setCookie(PREAUTH_COOKIE, token, this.base('/api/auth', 600));
  }

  clearPreauth(reply: FastifyReply): void {
    void reply.clearCookie(PREAUTH_COOKIE, { path: '/api/auth' });
  }

  setOauthState(reply: FastifyReply, state: string): void {
    void reply.setCookie(OAUTH_STATE_COOKIE, state, this.base('/api/auth/social', 600));
  }

  clearOauthState(reply: FastifyReply): void {
    void reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/social' });
  }
}

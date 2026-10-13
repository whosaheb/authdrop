import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import type Provider from 'oidc-provider';
import { Public } from '../../common/decorators/public.decorator.js';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator.js';
import { OIDC_MOUNT_PATH, OIDC_PROVIDER } from './oidc.constants.js';

type NodeRequest = IncomingMessage & { originalUrl?: string; body?: unknown };

/**
 * Hands every /oauth/* request to oidc-provider (a Koa app) via its Node http callback.
 *
 * - Protocol endpoints authenticate with client credentials / PKCE / signed cookies and carry their own
 *   CSRF protection, hence @SkipCsrf and @Public.
 * - Fastify's urlencoded parsing is bypassed in main.ts so the provider reads the raw stream itself.
 */
@ApiExcludeController()
@Public()
@SkipCsrf()
@Controller()
export class OidcController {
  private readonly callback: (req: IncomingMessage, res: ServerResponse) => Promise<void>;

  constructor(@Inject(OIDC_PROVIDER) provider: Provider) {
    this.callback = provider.callback() as unknown as (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  }

  @All([OIDC_MOUNT_PATH.slice(1), `${OIDC_MOUNT_PATH.slice(1)}/*`])
  handle(@Req() request: FastifyRequest, @Res() reply: FastifyReply): void {
    const raw = request.raw as NodeRequest;

    // Emulate Express' app.use('/oauth', ...): provider routes are relative to the mount path.
    raw.originalUrl = raw.url;
    raw.url = (raw.url ?? '/').slice(OIDC_MOUNT_PATH.length) || '/';
    if (request.body !== undefined && request.body !== null) raw.body = request.body; // JSON bodies parsed by Fastify

    // Fastify security headers (helmet) were set on `reply`; hijacking bypasses them, so copy them over.
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value as string | number | string[]);
    }

    reply.hijack();
    this.callback(raw, reply.raw).catch(() => {
      if (!reply.raw.headersSent) {
        reply.raw.statusCode = 500;
        reply.raw.end('{"error":"server_error"}');
      }
    });
  }
}

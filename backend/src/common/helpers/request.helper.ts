import { type FastifyRequest } from 'fastify';

export interface RequestMeta {
  ip: string;
  userAgent: string;
  requestId: string;
}

/** `request.ip` already honours Fastify's `trustProxy` setting, so X-Forwarded-For cannot be spoofed when disabled. */
export function getRequestMeta(request: FastifyRequest): RequestMeta {
  return {
    ip: request.ip,
    userAgent: String(request.headers['user-agent'] ?? '').slice(0, 255),
    requestId: String(request.id),
  };
}

/** Only same-origin relative paths are allowed as post-login destinations (open-redirect guard). */
export function isSafeRelativePath(path: string | undefined): path is string {
  return typeof path === 'string' && /^\/(?!\/|\\)[\w\-./?=&%]*$/.test(path);
}

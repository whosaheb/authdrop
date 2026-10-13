import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { JsonLogger } from './common/logging/json-logger.service.js';
import { AppConfig } from './config/app-config.service.js';
import { AVATAR_MAX_BYTES } from './infrastructure/storage/storage.service.js';
import { OIDC_MOUNT_PATH } from './modules/oidc/oidc.constants.js';
import { setupSwagger } from './swagger.js';

async function bootstrap(): Promise<void> {
  const config = new AppConfig(); // validates the environment: invalid config aborts the boot

  const adapter = new FastifyAdapter({
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024,
    genReqId: () => randomUUID(), // never trust a client supplied request id
    routerOptions: { ignoreTrailingSlash: true },
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: new JsonLogger(config.isProduction ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug']),
    bufferLogs: false,
    bodyParser: false, // Fastify's built-in JSON parser is used; form bodies are left to oidc-provider (below)
  });
  app.enableShutdownHooks();

  // oidc-provider parses form bodies itself (client_secret_post, PKCE, ...): hand it the untouched stream.
  adapter.getInstance().addContentTypeParser('application/x-www-form-urlencoded', (_request, _payload, done) => done(null, undefined));

  const r2 = config.storage;
  await app.register(fastifyHelmet, {
    hsts: config.isProduction ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // oidc-provider's logout / error pages carry inline CSS
        imgSrc: ["'self'", 'data:', ...(r2 ? [new URL(r2.publicBaseUrl).origin] : [])],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  });
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0, parts: 2 } });

  // API responses can contain personal data and one-time secrets: never cache them.
  adapter.getInstance().addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/')) void reply.header('Cache-Control', 'no-store');
    return payload;
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: OIDC_MOUNT_PATH.slice(1), method: RequestMethod.ALL },
      { path: `${OIDC_MOUNT_PATH.slice(1)}/*path`, method: RequestMethod.ALL },
    ],
  });

  if (config.swaggerEnabled) setupSwagger(app, config);

  await app.listen({ port: config.port, host: config.host });
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), level: 'fatal', msg: 'Failed to start', err: String(error) })}\n`);
  process.exit(1);
});

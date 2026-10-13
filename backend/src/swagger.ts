import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CSRF_HEADER, SESSION_COOKIE } from './common/constants/cookies.js';
import { type AppConfig } from './config/app-config.service.js';

/** OpenAPI for the portal REST API. The OIDC protocol endpoints are described by the discovery document. */
export function setupSwagger(app: INestApplication, config: AppConfig): void {
  const document = new DocumentBuilder()
    .setTitle('AuthDrop API')
    .setDescription(
      [
        'Passwordless OpenID Connect identity provider.',
        '',
        `**OIDC discovery:** \`${config.issuer}/.well-known/openid-configuration\` (authorize, token, userinfo, jwks, revocation, introspection, end-session).`,
        '',
        `The portal API authenticates with the HttpOnly \`${SESSION_COOKIE}\` cookie. Every state-changing request must also send the header \`${CSRF_HEADER}: 1\`.`,
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addCookieAuth(SESSION_COOKIE, { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE })
    .addApiKey({ type: 'apiKey', in: 'header', name: CSRF_HEADER, description: 'Must be "1" on POST/PUT/PATCH/DELETE' }, 'csrf')
    .addServer(config.appUrl)
    .build();

  const built = SwaggerModule.createDocument(app, document);
  built.security = [{ [SESSION_COOKIE]: [], csrf: [] }];
  SwaggerModule.setup('api/docs', app, built, { jsonDocumentUrl: 'api/openapi.json', customSiteTitle: 'AuthDrop API' });
}

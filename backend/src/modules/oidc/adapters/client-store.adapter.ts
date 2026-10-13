import { type Adapter, type AdapterPayload } from 'oidc-provider';
import { type CryptoService } from '../../../common/crypto/crypto.service.js';
import { type PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

const AUTH_METHOD = {
  CLIENT_SECRET_BASIC: 'client_secret_basic',
  CLIENT_SECRET_POST: 'client_secret_post',
  NONE: 'none',
} as const;

/**
 * Registered relying parties come from PostgreSQL (managed through the developer console API).
 * The provider is read-only with respect to clients: dynamic registration is disabled.
 * Secrets are decrypted on demand because oidc-provider needs the plaintext to authenticate clients.
 */
export class ClientStoreAdapter implements Adapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async find(id: string): Promise<AdapterPayload | undefined> {
    const client = await this.prisma.client.findUnique({ where: { clientId: id } });
    if (!client) return undefined;

    const isPublic = client.clientType === 'PUBLIC';
    return {
      client_id: client.clientId,
      client_name: client.name,
      ...(isPublic || !client.clientSecretEnc ? {} : { client_secret: this.crypto.decrypt(client.clientSecretEnc) }),
      redirect_uris: client.redirectUris,
      post_logout_redirect_uris: client.postLogoutRedirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: isPublic ? AUTH_METHOD.NONE : AUTH_METHOD[client.tokenEndpointAuthMethod],
      id_token_signed_response_alg: 'RS256',
    };
  }

  async upsert(): Promise<void> { throw new Error('Clients are managed through the developer API'); }
  async destroy(): Promise<void> { throw new Error('Clients are managed through the developer API'); }
  async findByUid(): Promise<undefined> { return undefined; }
  async findByUserCode(): Promise<undefined> { return undefined; }
  async consume(): Promise<void> { /* not applicable */ }
  async revokeByGrantId(): Promise<void> { /* not applicable */ }
}

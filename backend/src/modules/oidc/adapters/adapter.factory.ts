import { type Redis } from 'ioredis';
import { type Adapter, type AdapterPayload } from 'oidc-provider';
import { type CryptoService } from '../../../common/crypto/crypto.service.js';
import { type PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { ClientStoreAdapter } from './client-store.adapter.js';
import { GrantStoreAdapter } from './grant-store.adapter.js';
import { RedisAdapter } from './redis.adapter.js';

export interface AdapterDeps {
  redis: Redis;
  prisma: PrismaService;
  crypto: CryptoService;
}

/**
 * oidc-provider instantiates `new Adapter(modelName)` per model. This dispatches each model
 * to the right store while letting us inject Nest-managed dependencies.
 *
 *   Client -> PostgreSQL (registry)    Grant -> PostgreSQL (durable consent records)
 *   everything else -> Redis (sessions, interactions, codes, tokens)
 */
export function createAdapterClass(deps: AdapterDeps): new (name: string) => Adapter {
  return class DispatchingAdapter implements Adapter {
    private readonly delegate: Adapter;

    constructor(name: string) {
      if (name === 'Client') this.delegate = new ClientStoreAdapter(deps.prisma, deps.crypto);
      else if (name === 'Grant') this.delegate = new GrantStoreAdapter(deps.prisma);
      else this.delegate = new RedisAdapter(name, deps.redis);
    }

    upsert(id: string, payload: AdapterPayload, expiresIn: number) { return this.delegate.upsert(id, payload, expiresIn); }
    find(id: string) { return this.delegate.find(id); }
    findByUid(uid: string) { return this.delegate.findByUid(uid); }
    findByUserCode(userCode: string) { return this.delegate.findByUserCode(userCode); }
    consume(id: string) { return this.delegate.consume(id); }
    destroy(id: string) { return this.delegate.destroy(id); }
    revokeByGrantId(grantId: string) { return this.delegate.revokeByGrantId(grantId); }
  };
}

import { type Redis } from 'ioredis';
import { type Adapter, type AdapterPayload } from 'oidc-provider';

/** Models whose artefacts are tied to a Grant and must be revocable together. */
const GRANTABLE = new Set(['AccessToken', 'AuthorizationCode', 'RefreshToken', 'DeviceCode', 'BackchannelAuthenticationRequest']);
/** Models that can be consumed exactly once (replay detection). */
const CONSUMABLE = new Set(['AuthorizationCode', 'RefreshToken', 'DeviceCode', 'BackchannelAuthenticationRequest']);

export const oidcKey = (model: string, id: string) => `oidc:${model}:${id}`;
export const grantIndexKey = (grantId: string) => `oidc:grantidx:${grantId}`;
export const uidKey = (uid: string) => `oidc:uid:${uid}`;
export const userCodeKey = (userCode: string) => `oidc:usercode:${userCode}`;
/** Set of OIDC session ids per account, so logout / account deletion can end them all. */
export const accountSessionsKey = (accountId: string) => `oidc:acct-sessions:${accountId}`;

/**
 * Ephemeral oidc-provider models (sessions, interactions, auth codes, access/refresh tokens)
 * live in Redis with native TTLs. Based on the reference adapter shipped with oidc-provider.
 */
export class RedisAdapter implements Adapter {
  constructor(
    private readonly name: string,
    private readonly redis: Redis,
  ) {}

  private key(id: string): string {
    return oidcKey(this.name, id);
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    const key = this.key(id);
    const multi = this.redis.multi();

    if (CONSUMABLE.has(this.name)) multi.hset(key, { payload: JSON.stringify(payload) });
    else multi.set(key, JSON.stringify(payload));
    if (expiresIn) multi.expire(key, expiresIn);

    if (GRANTABLE.has(this.name) && payload.grantId) {
      const indexKey = grantIndexKey(payload.grantId);
      multi.rpush(indexKey, key);
      const currentTtl = await this.redis.ttl(indexKey);
      if (expiresIn > currentTtl) multi.expire(indexKey, expiresIn);
    }
    if (payload.userCode) {
      multi.set(userCodeKey(payload.userCode), id);
      if (expiresIn) multi.expire(userCodeKey(payload.userCode), expiresIn);
    }
    if (payload.uid) {
      multi.set(uidKey(payload.uid), id);
      if (expiresIn) multi.expire(uidKey(payload.uid), expiresIn);
    }
    if (this.name === 'Session' && payload.accountId) {
      multi.sadd(accountSessionsKey(payload.accountId), id);
      if (expiresIn) multi.expire(accountSessionsKey(payload.accountId), expiresIn);
    }
    await multi.exec();
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const key = this.key(id);
    if (CONSUMABLE.has(this.name)) {
      const stored = await this.redis.hgetall(key);
      if (!stored.payload) return undefined;
      const { payload, consumed } = stored as { payload: string; consumed?: string };
      return { ...(JSON.parse(payload) as AdapterPayload), ...(consumed ? { consumed: Number(consumed) } : undefined) };
    }
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as AdapterPayload) : undefined;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const id = await this.redis.get(uidKey(uid));
    return id ? this.find(id) : undefined;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const id = await this.redis.get(userCodeKey(userCode));
    return id ? this.find(id) : undefined;
  }

  async consume(id: string): Promise<void> {
    await this.redis.hset(this.key(id), 'consumed', Math.floor(Date.now() / 1000));
  }

  async destroy(id: string): Promise<void> {
    await this.redis.del(this.key(id));
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const indexKey = grantIndexKey(grantId);
    const keys = await this.redis.lrange(indexKey, 0, -1);
    const multi = this.redis.multi();
    keys.forEach((key) => multi.del(key));
    multi.del(indexKey);
    await multi.exec();
  }
}

import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { randomToken, sha256Hex } from '../../common/helpers/crypto.helper.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';

export interface PortalSession {
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  ip: string;
  userAgent: string;
  /** Authentication methods references (RFC 8176): otp, mfa, social:google ... */
  amr: string[];
}

const TOUCH_INTERVAL_MS = 60_000;
const sessionKey = (ref: string) => `sess:${ref}`;
const userSessionsKey = (userId: string) => `user-sess:${userId}`;

/**
 * Portal SSO sessions (the `authdrop_session` cookie).
 *
 * - The cookie carries a random 256-bit id. Redis only ever sees its SHA-256 ("ref"), so a Redis
 *   leak cannot be replayed as cookies.
 * - Idle timeout (sliding) AND absolute lifetime are both enforced (SOC 2 CC6.1 session management).
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  /** Public, non-reversible handle for a session. */
  refFor(sessionId: string): string {
    return sha256Hex(sessionId);
  }

  async create(userId: string, meta: { ip: string; userAgent: string }, amr: string[]): Promise<string> {
    const id = randomToken(32);
    const ref = this.refFor(id);
    const now = Date.now();
    const record: PortalSession = { userId, createdAt: now, lastSeenAt: now, ip: meta.ip, userAgent: meta.userAgent, amr };
    await this.redis.setJson(sessionKey(ref), record, this.config.session.idleTtlSeconds);
    await this.redis.client.sadd(userSessionsKey(userId), ref);
    await this.redis.client.expire(userSessionsKey(userId), this.config.session.absoluteTtlSeconds);
    return id;
  }

  async get(sessionId: string): Promise<PortalSession | null> {
    const ref = this.refFor(sessionId);
    const record = await this.redis.getJson<PortalSession>(sessionKey(ref));
    if (!record) return null;
    if (Date.now() > record.createdAt + this.config.session.absoluteTtlSeconds * 1000) {
      await this.destroyByRef(record.userId, ref);
      return null;
    }
    return record;
  }

  /** Sliding expiry, throttled so we do not write to Redis on every request. */
  async touch(sessionId: string, record: PortalSession): Promise<void> {
    const now = Date.now();
    if (now - record.lastSeenAt < TOUCH_INTERVAL_MS) return;
    const absoluteRemaining = Math.floor((record.createdAt + this.config.session.absoluteTtlSeconds * 1000 - now) / 1000);
    const ttl = Math.min(this.config.session.idleTtlSeconds, absoluteRemaining);
    if (ttl <= 0) return;
    await this.redis.setJson(sessionKey(this.refFor(sessionId)), { ...record, lastSeenAt: now }, ttl);
  }

  async destroy(sessionId: string): Promise<void> {
    const ref = this.refFor(sessionId);
    const record = await this.redis.getJson<PortalSession>(sessionKey(ref));
    await this.destroyByRef(record?.userId, ref);
  }

  async destroyByRef(userId: string | undefined, ref: string): Promise<void> {
    await this.redis.del(sessionKey(ref));
    if (userId) await this.redis.client.srem(userSessionsKey(userId), ref);
  }

  async listForUser(userId: string): Promise<Array<{ ref: string; session: PortalSession }>> {
    const refs = await this.redis.client.smembers(userSessionsKey(userId));
    if (refs.length === 0) return [];
    const raw = await this.redis.client.mget(refs.map(sessionKey));
    const live: Array<{ ref: string; session: PortalSession }> = [];
    const stale: string[] = [];
    refs.forEach((ref, index) => {
      const value = raw[index];
      if (value) live.push({ ref, session: JSON.parse(value) as PortalSession });
      else stale.push(ref);
    });
    if (stale.length > 0) await this.redis.client.srem(userSessionsKey(userId), ...stale);
    return live.sort((a, b) => b.session.lastSeenAt - a.session.lastSeenAt);
  }

  /** Revokes a single session, but only if it belongs to `userId`. */
  async destroyOwnedByRef(userId: string, ref: string): Promise<boolean> {
    const isMember = await this.redis.client.sismember(userSessionsKey(userId), ref);
    if (!isMember) return false;
    await this.destroyByRef(userId, ref);
    return true;
  }

  /** Revokes every session of a user (optionally keeping the current one). Returns how many were removed. */
  async destroyAllForUser(userId: string, exceptRef?: string): Promise<number> {
    const refs = (await this.redis.client.smembers(userSessionsKey(userId))).filter((ref) => ref !== exceptRef);
    if (refs.length === 0) return 0;
    await this.redis.del(...refs.map(sessionKey));
    await this.redis.client.srem(userSessionsKey(userId), ...refs);
    return refs.length;
  }
}

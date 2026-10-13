import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.service.js';

/** Fixed-window counter, atomic: INCR + EXPIRE-on-first + TTL in one round trip. */
const INCR_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('TTL', KEYS[1]) }
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: AppConfig) {
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: 3, enableReadyCheck: true });
    this.client.on('error', (error: Error) => this.logger.error(`Redis error: ${error.message}`));
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  /** Atomically reads and deletes (single-use secrets). */
  async getDelJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.getdel(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.del(...keys);
  }

  async incrementWindow(key: string, windowSeconds: number): Promise<{ count: number; ttl: number }> {
    const [count, ttl] = (await this.client.eval(INCR_WINDOW_SCRIPT, 1, key, windowSeconds)) as [number, number];
    return { count, ttl: Math.max(ttl, 1) };
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

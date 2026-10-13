import { Injectable } from '@nestjs/common';
import { randomToken, sha256Hex } from '../../common/helpers/crypto.helper.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { type SocialProviderId } from '../social/social.types.js';

export interface SocialLink {
  provider: SocialProviderId;
  providerUserId: string;
}

interface PreauthBase {
  /** OIDC interaction (login flow of a relying party) to resume when the ticket completes. */
  uid?: string;
  amr: string[];
}

/** Email proven (OTP or social) and the account has TOTP: second factor still required. */
export interface MfaPreauth extends PreauthBase {
  kind: 'mfa';
  userId: string;
  social?: SocialLink;
}

/** Email proven but no account yet: profile completion required. */
export interface RegistrationPreauth extends PreauthBase {
  kind: 'registration';
  email: string;
  prefill?: { firstName?: string; lastName?: string };
  social?: SocialLink;
}

/** Account just created; the optional security wizard is in progress. */
export interface RegisteredPreauth extends PreauthBase {
  kind: 'registered';
  userId: string;
}

export type PreauthTicket = MfaPreauth | RegistrationPreauth | RegisteredPreauth;

const TTL_SECONDS = 600;
const MAX_FAILURES = 5;
const ticketKey = (token: string) => `preauth:${sha256Hex(token)}`;
const failureKey = (token: string) => `preauth:fail:${sha256Hex(token)}`;

/**
 * Short-lived server-side state between the first factor and a completed login.
 * The token travels only in an HttpOnly cookie, never in JS-readable storage.
 */
@Injectable()
export class PreauthService {
  constructor(private readonly redis: RedisService) {}

  async create(ticket: PreauthTicket): Promise<string> {
    const token = randomToken(32);
    await this.redis.setJson(ticketKey(token), ticket, TTL_SECONDS);
    return token;
  }

  get(token: string | undefined): Promise<PreauthTicket | null> {
    return token ? this.redis.getJson<PreauthTicket>(ticketKey(token)) : Promise.resolve(null);
  }

  /** Replaces the payload while keeping the same token and a fresh TTL. */
  async replace(token: string, ticket: PreauthTicket): Promise<void> {
    await this.redis.setJson(ticketKey(token), ticket, TTL_SECONDS);
  }

  async consume(token: string): Promise<void> {
    await this.redis.del(ticketKey(token), failureKey(token));
  }

  /** Counts a failed second-factor attempt; burns the ticket after too many. Returns true if it was burned. */
  async registerFailure(token: string): Promise<boolean> {
    const { count } = await this.redis.incrementWindow(failureKey(token), TTL_SECONDS);
    if (count >= MAX_FAILURES) {
      await this.consume(token);
      return true;
    }
    return false;
  }
}

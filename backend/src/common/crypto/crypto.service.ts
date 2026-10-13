import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { decryptAes256Gcm, encryptAes256Gcm, hmacSha256Hex, sha256Hex } from '../helpers/crypto.helper.js';

/** Binds the stateless helpers to this deployment's key material. */
@Injectable()
export class CryptoService {
  constructor(private readonly config: AppConfig) {}

  /** Encrypt data at rest (TOTP secrets, client secrets). */
  encrypt(plaintext: string): string {
    return encryptAes256Gcm(plaintext, this.config.encryptionKey);
  }

  decrypt(payload: string): string {
    return decryptAes256Gcm(payload, this.config.encryptionKey);
  }

  /** Keyed hash for low-entropy secrets (OTPs, backup codes). */
  hmac(value: string): string {
    return hmacSha256Hex(value, this.config.hmacPepper);
  }

  /** Stable, non-reversible identifier for Redis keys so raw email addresses never appear in the keyspace. */
  fingerprint(value: string): string {
    return sha256Hex(value);
  }
}

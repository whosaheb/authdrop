import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { exportJWK, generateKeyPair } from 'jose';
import { type AppConfig } from './app-config.service.js';

export interface Jwks {
  keys: Array<Record<string, unknown>>;
}

/**
 * Loads the OIDC signing keys.
 *  1. OIDC_JWKS (JSON string)  - preferred for secret managers
 *  2. OIDC_JWKS_PATH (file)    - preferred for mounted secrets
 *  3. Non-production only: an ephemeral key is generated (tokens die on restart).
 * The first key signs; additional keys only verify, which enables zero-downtime rotation.
 */
export async function loadJwks(config: AppConfig, warn: (msg: string) => void): Promise<Jwks> {
  const { jwks, jwksPath } = config.oidc;

  let raw: string | undefined = jwks;
  if (!raw && jwksPath) {
    try {
      raw = await readFile(jwksPath, 'utf8');
    } catch (error) {
      if (config.isProduction) throw new Error(`Cannot read OIDC_JWKS_PATH (${jwksPath}): ${(error as Error).message}`);
    }
  }

  if (raw) {
    const parsed = JSON.parse(raw) as Jwks;
    if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) throw new Error('OIDC JWKS must contain at least one key');
    return parsed;
  }

  if (config.isProduction) throw new Error('OIDC signing keys are required in production');

  warn('No OIDC signing keys configured - generating an ephemeral development key. Run `npm run keys:generate`.');
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return {
    keys: [{ ...(await exportJWK(privateKey)), use: 'sig', alg: 'RS256', kid: randomBytes(8).toString('hex') }],
  };
}

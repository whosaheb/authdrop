/**
 * Generates every secret AuthDrop needs and writes the OIDC signing JWKS to ./secrets/jwks.json.
 *
 *   npm run keys:generate
 *
 * Copy the printed lines into your secret manager / .env. Never commit them.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { exportJWK, generateKeyPair } from 'jose';

const { privateKey } = await generateKeyPair('RS256', { modulusLength: 3072, extractable: true });
const jwk = await exportJWK(privateKey);
const kid = randomBytes(8).toString('hex');
const jwks = { keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid }] };

await mkdir('secrets', { recursive: true });
await writeFile('secrets/jwks.json', JSON.stringify(jwks, null, 2), { mode: 0o600 });

console.log('# Wrote secrets/jwks.json (RS256, kid=%s)\n', kid);
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
console.log(`HMAC_PEPPER=${randomBytes(48).toString('base64url')}`);
console.log(`OIDC_COOKIE_KEYS=${randomBytes(48).toString('base64url')}`);
console.log('OIDC_JWKS_PATH=./secrets/jwks.json');

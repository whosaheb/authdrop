import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() === 'true' : value;

/** Every environment variable the backend understands. Validated once at boot (fail fast). */
export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number) @IsInt() @Min(1) @Max(65535)
  PORT = 3000;

  @IsString() @IsNotEmpty()
  HOST = '0.0.0.0';

  @IsString() @IsNotEmpty()
  APP_URL!: string;

  @Transform(toBool) @IsBoolean()
  TRUST_PROXY = false;

  @IsString() @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString() @IsNotEmpty()
  REDIS_URL!: string;

  /** 32 random bytes, base64 encoded (44 chars). */
  @Matches(/^[A-Za-z0-9+/]{43}=$/, { message: 'ENCRYPTION_KEY must be 32 random bytes, base64 encoded' })
  ENCRYPTION_KEY!: string;

  @IsString() @MinLength(32)
  HMAC_PEPPER!: string;

  @IsString() @MinLength(32)
  OIDC_COOKIE_KEYS!: string;

  @IsOptional() @IsString()
  OIDC_JWKS?: string;

  @IsOptional() @IsString()
  OIDC_JWKS_PATH?: string;

  @Transform(toBool) @IsBoolean()
  OIDC_REQUIRE_PKCE = true;

  @Type(() => Number) @IsInt() @Min(300)
  SESSION_IDLE_TTL_SECONDS = 604_800;

  @Type(() => Number) @IsInt() @Min(300)
  SESSION_ABSOLUTE_TTL_SECONDS = 2_592_000;

  @Type(() => Number) @IsInt() @Min(60) @Max(3600)
  OTP_TTL_SECONDS = 600;

  @Type(() => Number) @IsInt() @Min(1) @Max(10)
  OTP_MAX_ATTEMPTS = 5;

  @Type(() => Number) @IsInt() @Min(0) @Max(600)
  OTP_RESEND_COOLDOWN_SECONDS = 60;

  @IsString() @IsNotEmpty()
  SMTP_HOST!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(65535)
  SMTP_PORT = 587;

  @Transform(toBool) @IsBoolean()
  SMTP_SECURE = false;

  @IsOptional() @IsString()
  SMTP_USER?: string;

  @IsOptional() @IsString()
  SMTP_PASS?: string;

  @IsString() @IsNotEmpty()
  MAIL_FROM!: string;

  @IsOptional() @IsString() R2_ACCOUNT_ID?: string;
  @IsOptional() @IsString() R2_ACCESS_KEY_ID?: string;
  @IsOptional() @IsString() R2_SECRET_ACCESS_KEY?: string;
  @IsOptional() @IsString() R2_BUCKET?: string;
  @IsOptional() @IsString() R2_PUBLIC_BASE_URL?: string;

  @IsOptional() @IsString() GOOGLE_CLIENT_ID?: string;
  @IsOptional() @IsString() GOOGLE_CLIENT_SECRET?: string;
  @IsOptional() @IsString() GITHUB_CLIENT_ID?: string;
  @IsOptional() @IsString() GITHUB_CLIENT_SECRET?: string;
  @IsOptional() @IsString() FACEBOOK_CLIENT_ID?: string;
  @IsOptional() @IsString() FACEBOOK_CLIENT_SECRET?: string;
  @IsString() @Matches(/^v\d+\.\d+$/) FACEBOOK_GRAPH_VERSION = 'v23.0';
  @IsOptional() @IsString() LINKEDIN_CLIENT_ID?: string;
  @IsOptional() @IsString() LINKEDIN_CLIENT_SECRET?: string;

  @Transform(toBool) @IsBoolean()
  DEVELOPER_SELF_ENROLL = false;

  @Transform(toBool) @IsBoolean()
  SWAGGER_ENABLED = false;

  @Type(() => Number) @IsInt() @Min(30)
  AUDIT_RETENTION_DAYS = 365;
}

/** Treats empty strings (e.g. `KEY=` lines in .env) as "not set". */
function stripEmpty(raw: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''),
  );
}

export function validateEnv(raw: NodeJS.ProcessEnv): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, stripEmpty(raw), { exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false, forbidUnknownValues: false });

  const problems = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`);

  // Cross-field rules class-validator cannot express.
  const pairs: Array<[string, string | undefined, string | undefined]> = [
    ['GOOGLE', env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
    ['GITHUB', env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET],
    ['FACEBOOK', env.FACEBOOK_CLIENT_ID, env.FACEBOOK_CLIENT_SECRET],
    ['LINKEDIN', env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET],
  ];
  for (const [name, id, secret] of pairs) {
    if (Boolean(id) !== Boolean(secret)) problems.push(`${name}_CLIENT_ID and ${name}_CLIENT_SECRET must be set together`);
  }

  const r2 = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET, env.R2_PUBLIC_BASE_URL];
  if (r2.some(Boolean) && !r2.every(Boolean)) problems.push('All R2_* variables must be set together (or none)');

  if (env.OIDC_COOKIE_KEYS.split(',').some((k) => k.trim().length < 32)) {
    problems.push('OIDC_COOKIE_KEYS: every comma-separated key must be at least 32 characters');
  }

  try {
    const url = new URL(env.APP_URL);
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') problems.push('APP_URL must be https in production');
    if (url.pathname !== '/' || url.search || url.hash) problems.push('APP_URL must be an origin only (no path)');
  } catch {
    problems.push('APP_URL must be a valid absolute URL');
  }

  if (env.NODE_ENV === 'production') {
    if (!env.OIDC_JWKS && !env.OIDC_JWKS_PATH) problems.push('OIDC_JWKS or OIDC_JWKS_PATH is required in production');
    if (!env.TRUST_PROXY) problems.push('TRUST_PROXY should be true in production (TLS terminates at the proxy)');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
  }
  return env;
}

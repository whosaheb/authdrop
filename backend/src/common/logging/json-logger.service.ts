import { type LoggerService, type LogLevel } from '@nestjs/common';

const REDACT_KEYS = /(otp|code|secret|token|password|authorization|cookie|pepper|key)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1)]),
  );
}

/**
 * One JSON object per line on stdout/stderr - ready for any log shipper (SOC 2 CC7.2 monitoring).
 * Structured fields are redacted by key name so secrets cannot leak by accident.
 */
export class JsonLogger implements LoggerService {
  constructor(private readonly levels: LogLevel[] = ['log', 'error', 'warn']) {}

  log(message: unknown, ...optional: unknown[]): void { this.write('info', message, optional); }
  error(message: unknown, ...optional: unknown[]): void { this.write('error', message, optional); }
  warn(message: unknown, ...optional: unknown[]): void { this.write('warn', message, optional); }
  debug(message: unknown, ...optional: unknown[]): void { this.write('debug', message, optional); }
  verbose(message: unknown, ...optional: unknown[]): void { this.write('verbose', message, optional); }

  private write(level: string, message: unknown, optional: unknown[]): void {
    const nestLevel = level === 'info' ? 'log' : (level as LogLevel);
    if (!this.levels.includes(nestLevel)) return;

    const entry: Record<string, unknown> = { time: new Date().toISOString(), level };
    const context = typeof optional.at(-1) === 'string' ? (optional.pop() as string) : undefined;
    if (context) entry.context = context;

    if (message instanceof Error) {
      entry.msg = message.message;
      entry.stack = message.stack;
    } else if (typeof message === 'object' && message !== null) {
      Object.assign(entry, redact(message));
    } else {
      entry.msg = String(message);
    }
    // Nest passes the stack trace as the 2nd arg of error()
    if (level === 'error' && typeof optional[0] === 'string') entry.stack = optional[0];

    const line = JSON.stringify(entry);
    (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
  }
}

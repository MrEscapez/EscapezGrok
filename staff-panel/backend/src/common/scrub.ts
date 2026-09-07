/**
 * Scrub secrets from strings before logging.
 * Never log passwords, API keys, RCON passwords, session cookies, or Bearer tokens.
 */

const SECRET_PATTERNS: RegExp[] = [
  // JSON / form style key=value or "key":"value"
  /(["']?(?:password|passwd|pwd|secret|api[_-]?key|token|authorization|rcon[_-]?password|session|cookie|hmac)["']?\s*[:=]\s*)(["']?)[^"',\s}\]]+(\2)/gi,
  // Header-style Authorization / X-Escapez-Api-Key
  /\b(Authorization\s*:\s*)(Bearer\s+)?\S+/gi,
  /\b(X-Escapez-Api-Key\s*:\s*)\S+/gi,
  // Cookie header values
  /\b((?:Set-)?Cookie\s*:\s*)[^\r\n]+/gi,
  // Long hex/base64-ish secrets (32+)
  /\b([A-Za-z0-9+/_-]{40,}=*)\b/g,
];

const REDACTED = '[REDACTED]';

/** Scrub a single string for safe logging. */
export function scrubSecrets(input: unknown): string {
  if (input === null || input === undefined) {
    return String(input);
  }
  let text = typeof input === 'string' ? input : safeStringify(input);
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, (...args) => {
      // First capturing group is the prefix we keep when present
      const prefix = typeof args[1] === 'string' ? args[1] : '';
      // Long opaque token pattern has no useful prefix
      if (pattern.source.includes('{40,')) {
        return REDACTED;
      }
      return `${prefix}${REDACTED}`;
    });
  }
  return text;
}

/** Scrub key fields in a plain object (shallow + nested one level for common shapes). */
export function scrubObject<T extends Record<string, unknown>>(obj: T): T {
  const sensitive = new Set([
    'password',
    'passwd',
    'pwd',
    'secret',
    'apiKey',
    'api_key',
    'token',
    'authorization',
    'rconPassword',
    'rcon_password',
    'session',
    'cookie',
    'hmac',
    'clientApiKey',
    'BRIDGE_API_KEY',
    'PTERO_API_KEY',
    'RCON_PASSWORD',
    'SESSION_SECRET',
  ]);
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (sensitive.has(k) || /password|secret|api[_-]?key|token|hmac/i.test(k)) {
      out[k] = REDACTED;
    } else if (typeof v === 'string') {
      out[k] = scrubSecrets(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = scrubObject(v as Record<string, unknown>);
    }
  }
  return out as T;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

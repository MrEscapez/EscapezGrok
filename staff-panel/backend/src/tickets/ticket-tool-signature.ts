import { createHmac, timingSafeEqual } from 'crypto';

const MAX_SKEW_SECONDS = 300;

/**
 * Ticket Tool webhook verification:
 * HMAC-SHA256(secret, `${timestamp}.${rawBody}`) as hex,
 * compared to X-TicketTool-Signature; reject if |now - ts| > 300s.
 */
export function verifyTicketToolSignature(opts: {
  secret: string;
  signature: string;
  timestamp: string;
  rawBody: string;
  nowSeconds?: number;
}): { ok: true } | { ok: false; reason: 'missing' | 'skew' | 'mismatch' } {
  const { secret, signature, timestamp, rawBody } = opts;
  if (!secret || !signature || !timestamp) {
    return { ok: false, reason: 'missing' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'skew' };
  }

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: 'skew' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'mismatch' };
    }
  } catch {
    return { ok: false, reason: 'mismatch' };
  }

  return { ok: true };
}

export { MAX_SKEW_SECONDS };

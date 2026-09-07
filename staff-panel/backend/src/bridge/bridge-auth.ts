import { timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';

/**
 * HMAC-ready bridge auth helpers (FASE 13 stub).
 *
 * Future EscapezCore calls may send:
 *   X-Escapez-Api-Key: <shared secret>
 *   X-Escapez-Timestamp: <unix ms>
 *   X-Escapez-Signature: hex(HMAC-SHA256(timestamp + "." + rawBody, secret))
 *
 * Today we only verify the API key header against BRIDGE_API_KEY.
 * Do not invent Discord webhooks or real signing secrets here.
 */

export function getBridgeApiKey(config: ConfigService): string {
  return config.get<string>('BRIDGE_API_KEY', 'CHANGE_ME_BRIDGE_KEY');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still compare to keep timing roughly similar on length mismatch
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Stub HMAC verify — currently API-key only.
 * Structure reserved for future body+timestamp HMAC without implementing it yet.
 */
export function verifyBridgeRequestStub(opts: {
  apiKeyHeader: string | undefined;
  expectedKey: string;
  /** reserved for future HMAC */
  signatureHeader?: string | undefined;
  timestampHeader?: string | undefined;
  rawBody?: string | undefined;
}): boolean {
  void opts.signatureHeader;
  void opts.timestampHeader;
  void opts.rawBody;
  if (!opts.apiKeyHeader) return false;
  return constantTimeEqual(opts.apiKeyHeader, opts.expectedKey);
}

export function hasValidBridgeApiKey(
  req: Request,
  config: ConfigService,
): boolean {
  const header = req.header('x-escapez-api-key') ?? undefined;
  return verifyBridgeRequestStub({
    apiKeyHeader: header,
    expectedKey: getBridgeApiKey(config),
    signatureHeader: req.header('x-escapez-signature') ?? undefined,
    timestampHeader: req.header('x-escapez-timestamp') ?? undefined,
  });
}

export function hasStaffSession(req: Request, auth: AuthService): boolean {
  const sessionId = req.cookies?.[auth.cookieName()] as string | undefined;
  return !!auth.getSession(sessionId);
}

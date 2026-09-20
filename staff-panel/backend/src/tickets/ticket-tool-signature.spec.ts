import { createHmac } from 'crypto';
import {
  MAX_SKEW_SECONDS,
  verifyTicketToolSignature,
} from './ticket-tool-signature';

function sign(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

describe('verifyTicketToolSignature', () => {
  const secret = 'whsec_test_secret';
  const body = '{"type":"TICKET_CREATED","data":{"ticketId":"t1"}}';
  const now = 1_700_000_000;

  it('accepts a valid signature within skew window', () => {
    const timestamp = String(now);
    const signature = sign(secret, timestamp, body);
    expect(
      verifyTicketToolSignature({
        secret,
        signature,
        timestamp,
        rawBody: body,
        nowSeconds: now,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects skewed timestamps', () => {
    const timestamp = String(now - MAX_SKEW_SECONDS - 1);
    const signature = sign(secret, timestamp, body);
    expect(
      verifyTicketToolSignature({
        secret,
        signature,
        timestamp,
        rawBody: body,
        nowSeconds: now,
      }),
    ).toEqual({ ok: false, reason: 'skew' });
  });

  it('rejects invalid signatures', () => {
    const timestamp = String(now);
    expect(
      verifyTicketToolSignature({
        secret,
        signature: 'deadbeef',
        timestamp,
        rawBody: body,
        nowSeconds: now,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects missing fields', () => {
    expect(
      verifyTicketToolSignature({
        secret: '',
        signature: 'x',
        timestamp: String(now),
        rawBody: body,
        nowSeconds: now,
      }),
    ).toEqual({ ok: false, reason: 'missing' });
  });
});

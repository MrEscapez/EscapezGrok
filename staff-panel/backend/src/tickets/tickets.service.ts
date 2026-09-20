import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { TicketToolCredentialsStore } from './ticket-tool-credentials.store';
import { verifyTicketToolSignature } from './ticket-tool-signature';
import { TicketsStore } from './tickets.store';
import type {
  StoredTicket,
  StoredTicketMessage,
  TicketDetail,
  TicketListItem,
} from './tickets.types';

const TT_API_BASE = 'https://api.ticket-tool.app/v1';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly creds: TicketToolCredentialsStore,
    private readonly store: TicketsStore,
  ) {}

  list(): { items: TicketListItem[]; configured: boolean } {
    return {
      configured:
        this.creds.isApiConfigured() ||
        this.creds.isWebhookConfigured() ||
        this.store.list().length > 0,
      items: this.store.list().map(toListItem),
    };
  }

  get(id: string): TicketDetail | null {
    const t = this.store.get(id);
    return t ? toDetail(t) : null;
  }

  /**
   * Verify HMAC + timestamp, then upsert local ticket from webhook payload.
   * Public endpoint — auth is signature, not staff session.
   */
  handleWebhook(opts: {
    rawBody: string;
    signature: string | undefined;
    timestamp: string | undefined;
    eventHeader: string | undefined;
  }): { ok: true } {
    const secret = this.creds.getSecrets().webhookSecret;
    if (!secret || secret === 'CHANGE_ME') {
      throw new UnauthorizedException('Webhook-secret niet geconfigureerd');
    }

    const verified = verifyTicketToolSignature({
      secret,
      signature: opts.signature ?? '',
      timestamp: opts.timestamp ?? '',
      rawBody: opts.rawBody,
    });
    if (!verified.ok) {
      this.logger.warn(`Ticket Tool webhook rejected: ${verified.reason}`);
      throw new UnauthorizedException('Ongeldige webhook-handtekening');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(opts.rawBody);
    } catch {
      throw new UnauthorizedException('Ongeldige webhook-body');
    }

    const eventType =
      opts.eventHeader ||
      pickString(payload, 'type') ||
      pickString(payload, 'event') ||
      'UNKNOWN';

    this.applyWebhookEvent(eventType, payload);
    return { ok: true };
  }

  /**
   * Pull tickets from Ticket Tool REST API and upsert local store.
   * Requires tickets:manage + configured API token.
   */
  async syncFromApi(): Promise<{
    ok: boolean;
    upserted: number;
    message: string;
  }> {
    if (!this.creds.isApiConfigured()) {
      throw new ServiceUnavailableException(
        'Ticket Tool API-token niet geconfigureerd. Stel deze in onder Instellingen.',
      );
    }
    const token = this.creds.getSecrets().apiToken;
    let cursor: string | null = null;
    let upserted = 0;
    let pages = 0;

    try {
      do {
        const url = new URL(`${TT_API_BASE}/tickets`);
        url.searchParams.set('limit', '100');
        if (cursor) url.searchParams.set('cursor', cursor);

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          this.logger.warn(`Ticket Tool sync HTTP ${res.status}`);
          throw new ServiceUnavailableException(
            `Ticket Tool API gaf HTTP ${res.status}. Controleer token en scopes (tickets:read).`,
          );
        }

        const json = (await res.json()) as {
          data?: unknown[];
          pagination?: { nextCursor?: string | null; hasMore?: boolean };
        };
        const rows = Array.isArray(json.data) ? json.data : [];
        for (const row of rows) {
          const mapped = mapApiTicket(row);
          if (mapped) {
            this.store.upsert(mapped);
            upserted += 1;
          }
        }
        pages += 1;
        const hasMore = Boolean(json.pagination?.hasMore);
        cursor = hasMore ? (json.pagination?.nextCursor ?? null) : null;
      } while (cursor && pages < 20);

      return {
        ok: true,
        upserted,
        message: `${upserted} ticket(s) gesynchroniseerd vanaf Ticket Tool.`,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const msg = err instanceof Error ? err.message : 'onbekend';
      this.logger.warn(`Ticket Tool sync failed: ${msg}`);
      throw new ServiceUnavailableException(
        'Ticket Tool sync mislukt (netwerk/timeout).',
      );
    }
  }

  private applyWebhookEvent(eventType: string, payload: unknown): void {
    const data =
      payload &&
      typeof payload === 'object' &&
      'data' in (payload as Record<string, unknown>)
        ? (payload as { data: unknown }).data
        : payload;

    if (eventType === 'TICKET_DELETED') {
      const id = extractTicketId(data) ?? extractTicketId(payload);
      if (id) this.store.remove(id);
      return;
    }

    if (eventType === 'TICKET_MESSAGE_CREATED') {
      const ticketId =
        pickString(data, 'ticketId') ||
        extractTicketId(data) ||
        extractTicketId(payload);
      if (!ticketId) return;
      if (!this.store.get(ticketId)) {
        this.store.upsert(stubTicket(ticketId, data));
      }
      const message = mapWebhookMessage(data);
      if (message) this.store.appendMessage(ticketId, message);
      return;
    }

    const mapped = mapWebhookTicket(data, eventType);
    if (mapped) this.store.upsert(mapped);
  }
}

function toListItem(t: StoredTicket): TicketListItem {
  return {
    id: t.id,
    subject: t.subject,
    player: t.player,
    status: t.status,
    ticketNumber: t.ticketNumber,
    claimedBy: t.claimedBy,
    priority: t.priority,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function toDetail(t: StoredTicket): TicketDetail {
  return {
    ...toListItem(t),
    categoryId: t.categoryId,
    channelId: t.channelId,
    closedAt: t.closedAt,
    messages: t.messages,
  };
}

function pickString(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function pickNumber(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function extractTicketId(data: unknown): string | undefined {
  return (
    pickString(data, 'ticketId') ||
    pickString(data, 'id') ||
    pickString(data, 'ticket_id')
  );
}

function creatorName(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const c = (data as Record<string, unknown>).creator;
  if (c && typeof c === 'object') {
    return pickString(c, 'username') || pickString(c, 'id') || '';
  }
  return (
    pickString(data, 'player') ||
    pickString(data, 'username') ||
    pickString(data, 'userTag') ||
    ''
  );
}

function claimedName(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const c = (data as Record<string, unknown>).claimedBy;
  if (c && typeof c === 'object') {
    return pickString(c, 'username') || pickString(c, 'id') || null;
  }
  if (typeof c === 'string') return c;
  return null;
}

function statusFromEvent(eventType: string): string {
  switch (eventType) {
    case 'TICKET_CLOSED':
      return 'CLOSED';
    case 'TICKET_REOPENED':
    case 'TICKET_CREATED':
      return 'OPEN';
    case 'TICKET_DELETED':
      return 'DELETED';
    default:
      return 'OPEN';
  }
}

function mapApiTicket(row: unknown): StoredTicket | null {
  if (!row || typeof row !== 'object') return null;
  const id = pickString(row, 'id');
  if (!id) return null;
  const ticketNumber = pickNumber(row, 'ticketNumber');
  const subject =
    pickString(row, 'subject') ||
    (ticketNumber != null ? `Ticket #${ticketNumber}` : 'Ticket');
  const now = new Date().toISOString();
  return {
    id,
    ticketNumber,
    subject,
    player: creatorName(row),
    status: pickString(row, 'status') || 'OPEN',
    priority: pickString(row, 'priority') || null,
    claimedBy: claimedName(row),
    categoryId: pickString(row, 'categoryId') || null,
    channelId: pickString(row, 'channelId') || null,
    createdAt: pickString(row, 'createdAt') || now,
    updatedAt: pickString(row, 'updatedAt') || now,
    closedAt: pickString(row, 'closedAt') || null,
    messages: [],
    raw: sanitizeRaw(row),
  };
}

function mapWebhookTicket(
  data: unknown,
  eventType: string,
): StoredTicket | null {
  const id = extractTicketId(data);
  if (!id) return null;
  const now = new Date().toISOString();
  const ticketNumber =
    pickNumber(data, 'ticketNumber') ?? pickNumber(data, 'number');
  const subject =
    pickString(data, 'subject') ||
    (ticketNumber != null ? `Ticket #${ticketNumber}` : 'Ticket');
  const status = pickString(data, 'status') || statusFromEvent(eventType);
  return {
    id,
    ticketNumber,
    subject,
    player: creatorName(data),
    status,
    priority: pickString(data, 'priority') || null,
    claimedBy: claimedName(data),
    categoryId: pickString(data, 'categoryId') || null,
    channelId: pickString(data, 'channelId') || null,
    createdAt: pickString(data, 'createdAt') || now,
    updatedAt: pickString(data, 'updatedAt') || now,
    closedAt:
      status === 'CLOSED'
        ? pickString(data, 'closedAt') || now
        : pickString(data, 'closedAt') || null,
    messages: [],
    raw: sanitizeRaw(data),
  };
}

function stubTicket(id: string, data: unknown): StoredTicket {
  return (
    mapWebhookTicket(
      data && typeof data === 'object' ? { ...data, id } : { id },
      'TICKET_CREATED',
    ) ?? {
      id,
      ticketNumber: null,
      subject: 'Ticket',
      player: '',
      status: 'OPEN',
      priority: null,
      claimedBy: null,
      categoryId: null,
      channelId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closedAt: null,
      messages: [],
    }
  );
}

function mapWebhookMessage(data: unknown): StoredTicketMessage | null {
  if (!data || typeof data !== 'object') return null;
  const id =
    pickString(data, 'messageId') ||
    pickString(data, 'id') ||
    `msg_${Date.now()}`;
  const content =
    pickString(data, 'content') ||
    pickString(data, 'message') ||
    pickString(data, 'preview') ||
    '';
  const author =
    pickString(data, 'author') ||
    pickString(data, 'username') ||
    creatorName(data) ||
    'onbekend';
  return {
    id,
    content,
    author,
    createdAt: pickString(data, 'createdAt') || new Date().toISOString(),
  };
}

/** Drop anything that looks like a secret before persisting raw fragments. */
function sanitizeRaw(row: unknown): Record<string, unknown> | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (/token|secret|authorization|password|api[_-]?key/i.test(k)) continue;
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    ) {
      out[k] = v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        if (/token|secret|authorization|password|api[_-]?key/i.test(nk)) {
          continue;
        }
        if (
          typeof nv === 'string' ||
          typeof nv === 'number' ||
          typeof nv === 'boolean' ||
          nv === null
        ) {
          nested[nk] = nv;
        }
      }
      out[k] = nested;
    }
  }
  return out;
}

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { DiscordBridgeCredentialsStore } from './discord-bridge-credentials.store';
import { TicketToolCredentialsStore } from './ticket-tool-credentials.store';
import { verifyTicketToolSignature } from './ticket-tool-signature';
import { TicketsStore } from './tickets.store';
import type {
  StoredTicket,
  StoredTicketMessage,
  TicketDetail,
  TicketListItem,
} from './tickets.types';
import type { BridgeUpsertDto } from './dto/bridge-upsert.dto';
import type { BridgeMessageDto } from './dto/bridge-message.dto';
import type { BridgeCloseDto } from './dto/bridge-close.dto';

const TT_API_BASE = 'https://api.ticket-tool.app/v1';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly creds: TicketToolCredentialsStore,
    private readonly bridgeCreds: DiscordBridgeCredentialsStore,
    private readonly store: TicketsStore,
  ) {}

  list(): { items: TicketListItem[]; configured: boolean } {
    return {
      configured:
        this.bridgeCreds.isConfigured() ||
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
   * Auth for Discord bridge ingest — NOT staff cookie.
   * Accepts Authorization: Bearer <secret> or X-Staff-Bridge-Secret.
   */
  assertBridgeAuth(opts: {
    authorization?: string;
    bridgeSecretHeader?: string;
  }): void {
    const expected = this.bridgeCreds.getSecret();
    if (!expected || expected === 'CHANGE_ME') {
      throw new UnauthorizedException(
        'Discord bridge-secret niet geconfigureerd',
      );
    }
    const fromBearer = extractBearer(opts.authorization);
    const fromHeader = (opts.bridgeSecretHeader || '').trim();
    const provided = fromBearer || fromHeader;
    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Ongeldig bridge-secret');
    }
  }

  bridgeUpsert(dto: BridgeUpsertDto): { ok: true; id: string } {
    const now = new Date().toISOString();
    const existing = this.store.findByChannelId(dto.channelId);
    const id = existing?.id ?? dto.channelId;
    const ticketNumber = parseTicketNumber(dto.channelName);
    const subject =
      dto.channelName ||
      (ticketNumber != null ? `Ticket #${ticketNumber}` : 'Discord-ticket');
    const player =
      (dto.openerTag && dto.openerTag.trim()) ||
      existing?.player ||
      (dto.openerId && dto.openerId.trim()) ||
      '';

    const mapped: StoredTicket = {
      id,
      ticketNumber: existing?.ticketNumber ?? ticketNumber,
      subject,
      player,
      status: existing?.status === 'CLOSED' ? 'OPEN' : existing?.status || 'OPEN',
      priority: existing?.priority ?? null,
      claimedBy: existing?.claimedBy ?? null,
      categoryId: dto.categoryId ?? existing?.categoryId ?? null,
      channelId: dto.channelId,
      guildId: dto.guildId,
      channelName: dto.channelName,
      openerId: dto.openerId ?? existing?.openerId ?? null,
      source: 'discord-bridge',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      closedAt: null,
      messages: [],
      raw: {
        channelId: dto.channelId,
        guildId: dto.guildId,
        channelName: dto.channelName,
      },
    };
    this.store.upsert(mapped);
    return { ok: true, id };
  }

  bridgeMessage(dto: BridgeMessageDto): { ok: true; id: string } {
    let ticket = this.store.findByChannelId(dto.channelId);
    if (!ticket) {
      const now = new Date().toISOString();
      ticket = this.store.upsert({
        id: dto.channelId,
        ticketNumber: null,
        subject: 'Discord-ticket',
        player: dto.authorTag || '',
        status: 'OPEN',
        priority: null,
        claimedBy: null,
        categoryId: null,
        channelId: dto.channelId,
        guildId: null,
        channelName: null,
        openerId: dto.isBot || dto.isWebhook ? null : dto.authorId,
        source: 'discord-bridge',
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        messages: [],
      });
    }

    const attachments = Array.isArray(dto.attachments)
      ? dto.attachments.filter((u) => typeof u === 'string' && u.trim())
      : [];
    let content = (dto.content || '').trim();
    if (attachments.length > 0) {
      const urls = attachments.join('\n');
      content = content ? `${content}\n${urls}` : urls;
    }

    const message: StoredTicketMessage = {
      id: dto.messageId,
      content,
      author: dto.authorTag || dto.authorId || 'onbekend',
      authorId: dto.authorId || null,
      createdAt: dto.timestamp || new Date().toISOString(),
      attachments,
      isBot: Boolean(dto.isBot),
      isWebhook: Boolean(dto.isWebhook),
    };
    this.store.appendMessage(ticket.id, message);
    return { ok: true, id: ticket.id };
  }

  bridgeClose(dto: BridgeCloseDto): { ok: true; id: string | null } {
    const ticket = this.store.findByChannelId(dto.channelId);
    if (!ticket) {
      return { ok: true, id: null };
    }
    this.store.close(ticket.id);
    return { ok: true, id: ticket.id };
  }

  /**
   * Verify HMAC + timestamp, then upsert local ticket from webhook payload.
   * Optional Ticket Tool Pro path — auth is signature, not staff session.
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
   * Optional Ticket Tool Pro REST sync. Prefer Discord bridge for free plans.
   */
  async syncFromApi(): Promise<{
    ok: boolean;
    upserted: number;
    message: string;
  }> {
    if (!this.creds.isApiConfigured()) {
      // Local reload — no Pro API needed when using Discord bridge
      const count = this.store.list().length;
      return {
        ok: true,
        upserted: count,
        message: `${count} ticket(s) lokaal herladen (geen Ticket Tool Pro sync).`,
      };
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

function extractBearer(authorization?: string): string {
  if (!authorization) return '';
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return m ? m[1].trim() : '';
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function parseTicketNumber(name: string): number | null {
  const m = /(\d+)\s*$/.exec(name || '');
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
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
    channelId: t.channelId,
    channelName: t.channelName ?? null,
    source: t.source ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function toDetail(t: StoredTicket): TicketDetail {
  return {
    ...toListItem(t),
    categoryId: t.categoryId,
    guildId: t.guildId ?? null,
    openerId: t.openerId ?? null,
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
    source: 'ticket-tool',
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
    source: 'ticket-tool',
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
      source: 'ticket-tool',
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

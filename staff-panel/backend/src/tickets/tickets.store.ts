import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type {
  StoredTicket,
  StoredTicketMessage,
  TicketsFileShape,
} from './tickets.types';

@Injectable()
export class TicketsStore implements OnModuleInit {
  private readonly logger = new Logger(TicketsStore.name);
  private dataPath = '';
  private byId = new Map<string, StoredTicket>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const configured = this.config.get<string>('TICKETS_DATA_PATH');
    this.dataPath =
      configured && configured.trim()
        ? configured.trim()
        : join(process.cwd(), 'data', 'tickets.json');
    this.load();
  }

  list(): StoredTicket[] {
    return [...this.byId.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  get(id: string): StoredTicket | undefined {
    return this.byId.get(id);
  }

  findByChannelId(channelId: string): StoredTicket | undefined {
    for (const t of this.byId.values()) {
      if (t.channelId === channelId || t.id === channelId) return t;
    }
    return undefined;
  }

  upsert(ticket: StoredTicket): StoredTicket {
    const existing = this.byId.get(ticket.id);
    const merged: StoredTicket = existing
      ? {
          ...existing,
          ...ticket,
          messages:
            ticket.messages.length > 0 ? ticket.messages : existing.messages,
          raw: ticket.raw ?? existing.raw,
        }
      : ticket;
    this.byId.set(merged.id, merged);
    this.persist();
    return merged;
  }

  appendMessage(ticketId: string, message: StoredTicketMessage): void {
    const t = this.byId.get(ticketId);
    if (!t) return;
    if (t.messages.some((m) => m.id === message.id)) return;
    t.messages = [...t.messages, message];
    t.updatedAt = message.createdAt || new Date().toISOString();
    this.byId.set(ticketId, t);
    this.persist();
  }

  close(ticketId: string, closedAt?: string): StoredTicket | undefined {
    const t = this.byId.get(ticketId);
    if (!t) return undefined;
    const now = closedAt || new Date().toISOString();
    t.status = 'CLOSED';
    t.closedAt = now;
    t.updatedAt = now;
    this.byId.set(ticketId, t);
    this.persist();
    return t;
  }

  remove(id: string): void {
    if (!this.byId.has(id)) return;
    this.byId.delete(id);
    this.persist();
  }

  private load(): void {
    try {
      if (!existsSync(this.dataPath)) return;
      const raw = readFileSync(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw) as TicketsFileShape;
      this.byId.clear();
      if (Array.isArray(parsed.tickets)) {
        for (const row of parsed.tickets) {
          if (!row || typeof row.id !== 'string') continue;
          this.byId.set(row.id, normalizeTicket(row));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Could not load tickets.json: ${msg}`);
    }
  }

  private persist(): void {
    const dir = dirname(this.dataPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: TicketsFileShape = {
      updatedAt: new Date().toISOString(),
      tickets: this.list(),
    };
    writeFileSync(this.dataPath, `${JSON.stringify(payload, null, 2)}\n`, {
      mode: 0o600,
    });
  }
}

function normalizeTicket(row: StoredTicket): StoredTicket {
  return {
    id: row.id,
    ticketNumber:
      typeof row.ticketNumber === 'number' ? row.ticketNumber : null,
    subject: typeof row.subject === 'string' ? row.subject : '',
    player: typeof row.player === 'string' ? row.player : '',
    status: typeof row.status === 'string' ? row.status : 'OPEN',
    priority: typeof row.priority === 'string' ? row.priority : null,
    claimedBy: typeof row.claimedBy === 'string' ? row.claimedBy : null,
    categoryId: typeof row.categoryId === 'string' ? row.categoryId : null,
    channelId: typeof row.channelId === 'string' ? row.channelId : null,
    guildId: typeof row.guildId === 'string' ? row.guildId : null,
    channelName: typeof row.channelName === 'string' ? row.channelName : null,
    openerId: typeof row.openerId === 'string' ? row.openerId : null,
    source: typeof row.source === 'string' ? row.source : null,
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof row.updatedAt === 'string'
        ? row.updatedAt
        : new Date().toISOString(),
    closedAt: typeof row.closedAt === 'string' ? row.closedAt : null,
    messages: Array.isArray(row.messages) ? row.messages : [],
    raw:
      row.raw && typeof row.raw === 'object'
        ? (row.raw as Record<string, unknown>)
        : undefined,
  };
}

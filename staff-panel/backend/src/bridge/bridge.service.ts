import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { randomUUID } from 'crypto';

export type BridgeHeartbeat = {
  receivedAt: string;
  body: Record<string, unknown>;
};

export type BridgeBufferedEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  source: 'bridge' | 'system';
};

export type RealtimeMessage = {
  kind: 'heartbeat' | 'event' | 'ping';
  data: unknown;
  at: string;
};

const MAX_BUFFER = 100;

/**
 * In-memory EscapezCore bridge state (FASE 13 stubs).
 * Heartbeat + event ring buffer; Subject fans out to SSE clients.
 */
@Injectable()
export class BridgeService {
  private lastHeartbeat: BridgeHeartbeat | null = null;
  private readonly buffer: BridgeBufferedEvent[] = [];
  private readonly realtime$ = new Subject<RealtimeMessage>();

  getRealtimeStream(): Subject<RealtimeMessage> {
    return this.realtime$;
  }

  recordHeartbeat(body: Record<string, unknown>): BridgeHeartbeat {
    const entry: BridgeHeartbeat = {
      receivedAt: new Date().toISOString(),
      body,
    };
    this.lastHeartbeat = entry;
    this.realtime$.next({
      kind: 'heartbeat',
      data: entry,
      at: entry.receivedAt,
    });
    return entry;
  }

  pushEvent(
    type: string,
    payload: Record<string, unknown>,
    timestamp?: string,
  ): BridgeBufferedEvent {
    const event: BridgeBufferedEvent = {
      id: `evt_${randomUUID()}`,
      type,
      payload,
      timestamp: timestamp ?? new Date().toISOString(),
      source: 'bridge',
    };
    this.buffer.push(event);
    while (this.buffer.length > MAX_BUFFER) {
      this.buffer.shift();
    }
    this.realtime$.next({
      kind: 'event',
      data: event,
      at: event.timestamp,
    });
    return event;
  }

  getLastHeartbeat(): BridgeHeartbeat | null {
    return this.lastHeartbeat;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getRecentEvents(limit = 50): BridgeBufferedEvent[] {
    const n = Math.max(1, Math.min(limit, MAX_BUFFER));
    return this.buffer.slice(-n);
  }

  getStatus(): {
    lastHeartbeat: BridgeHeartbeat | null;
    bufferSize: number;
  } {
    return {
      lastHeartbeat: this.lastHeartbeat,
      bufferSize: this.buffer.length,
    };
  }
}

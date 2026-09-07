import { useEffect, useRef, useState } from 'react';
import { realtimeStreamUrl } from '../lib/api';

export type LiveFeedItem = {
  id: string;
  kind: string;
  type?: string;
  label: string;
  at: string;
  raw?: unknown;
};

const MAX_EVENTS = 30;

function dutchLabel(kind: string, type?: string, data?: unknown): string {
  if (kind === 'hello') return 'Verbonden met live feed';
  if (kind === 'ping') return 'Keep-alive';
  if (kind === 'heartbeat') return 'EscapezCore heartbeat ontvangen';
  if (kind === 'event') {
    switch (type) {
      case 'report.created':
        return 'Nieuw report';
      case 'player.join':
        return 'Speler joined';
      case 'player.quit':
        return 'Speler left';
      case 'staffchat':
        return 'Staffchat-bericht';
      default:
        return type ? `Event: ${type}` : 'Bridge-event';
    }
  }
  void data;
  return kind || 'Onbekend';
}

function parseMessage(raw: MessageEvent): LiveFeedItem | null {
  try {
    const parsed = JSON.parse(String(raw.data)) as {
      kind?: string;
      data?: unknown;
      at?: string;
      replay?: boolean;
    };
    const kind = parsed.kind ?? 'event';
    if (kind === 'ping') return null; // skip keep-alives in UI

    let type: string | undefined;
    let at = parsed.at ?? new Date().toISOString();
    if (kind === 'event' && parsed.data && typeof parsed.data === 'object') {
      const ev = parsed.data as { type?: string; timestamp?: string; id?: string };
      type = ev.type;
      if (ev.timestamp) at = ev.timestamp;
      return {
        id: ev.id ?? `live_${at}_${type ?? kind}`,
        kind,
        type,
        label: dutchLabel(kind, type, parsed.data),
        at,
        raw: parsed,
      };
    }
    if (kind === 'heartbeat' && parsed.data && typeof parsed.data === 'object') {
      const hb = parsed.data as { receivedAt?: string };
      at = hb.receivedAt ?? at;
    }
    return {
      id: `live_${kind}_${at}_${Math.random().toString(36).slice(2, 8)}`,
      kind,
      type,
      label: dutchLabel(kind, type, parsed.data),
      at,
      raw: parsed,
    };
  } catch {
    return null;
  }
}

export type LiveFeedState = {
  events: LiveFeedItem[];
  status: 'idle' | 'connecting' | 'open' | 'error' | 'unsupported';
  errorMessage: string | null;
};

/**
 * SSE live feed for staff dashboard. Reconnects on error; graceful if EventSource missing.
 */
export function useLiveFeed(enabled: boolean): LiveFeedState {
  const [events, setEvents] = useState<LiveFeedItem[]>([]);
  const [status, setStatus] = useState<LiveFeedState['status']>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    if (typeof EventSource === 'undefined') {
      setStatus('unsupported');
      setErrorMessage('Server-Sent Events niet ondersteund in deze browser.');
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      setErrorMessage(null);
      try {
        const es = new EventSource(realtimeStreamUrl(), {
          withCredentials: true,
        });
        esRef.current = es;

        es.onopen = () => {
          if (!cancelled) setStatus('open');
        };

        es.onmessage = (msg) => {
          const item = parseMessage(msg);
          if (!item) return;
          setEvents((prev) => {
            const next = [item, ...prev.filter((e) => e.id !== item.id)];
            return next.slice(0, MAX_EVENTS);
          });
        };

        es.onerror = () => {
          es.close();
          esRef.current = null;
          if (cancelled) return;
          setStatus('error');
          setErrorMessage('Verbinding verbroken — opnieuw verbinden…');
          retryRef.current = setTimeout(connect, 3000);
        };
      } catch {
        setStatus('error');
        setErrorMessage('Kan live feed niet starten.');
        retryRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled]);

  return { events, status, errorMessage };
}

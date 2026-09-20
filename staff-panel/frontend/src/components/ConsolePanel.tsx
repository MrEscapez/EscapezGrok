import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCan } from '../hooks/useMeQuery';
import {
  ApiError,
  consoleStreamUrl,
  fetchConsoleWebsocket,
  fetchPteroSettings,
  postConsoleCommand,
  type ConsoleStreamEvent,
} from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import { HelpTip } from './HelpTip';

type Props = {
  /** Ptero server identifier; falls back to default from settings. */
  serverIdentifier?: string | null;
};

type ConnState = 'idle' | 'connecting' | 'connected' | 'error' | 'missing_key';

const MAX_LINES = 800;

export function ConsolePanel({ serverIdentifier }: Props) {
  const can = useCan();
  const canRead = can('console:read');
  const canWrite = can('console:write') || can('server:command');

  const [conn, setConn] = useState<ConnState>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const autoScroll = useRef(true);

  const pteroQuery = useQuery({
    queryKey: ['settings', 'pterodactyl'],
    queryFn: fetchPteroSettings,
    staleTime: 30_000,
    retry: false,
    enabled: canRead,
  });

  const clientKeyMissing =
    pteroQuery.isSuccess && !pteroQuery.data.clientApiKeyConfigured;

  const appendLine = useCallback((line: string) => {
    setLines((prev) => {
      const next = prev.length >= MAX_LINES ? prev.slice(-MAX_LINES + 1) : [...prev];
      next.push(line);
      return next;
    });
  }, []);

  const disconnect = useCallback(() => {
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        /* ignore */
      }
      esRef.current = null;
    }
    setConn((c) => (c === 'missing_key' ? c : 'idle'));
    setStatusMsg(null);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  useEffect(() => {
    if (autoScroll.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines]);

  async function connect() {
    if (!canRead) return;
    if (clientKeyMissing) {
      setConn('missing_key');
      return;
    }
    disconnect();
    setConn('connecting');
    setStatusMsg(null);
    setLines([]);
    try {
      const creds = await fetchConsoleWebsocket(
        serverIdentifier || undefined,
      );
      if (!creds.configured || creds.stub) {
        if (
          !creds.configured ||
          (creds.message && creds.message.includes('Client API'))
        ) {
          setConn('missing_key');
          setStatusMsg(creds.message ?? null);
          return;
        }
        setConn('error');
        setStatusMsg(creds.message ?? 'Kon console niet verbinden.');
        return;
      }

      // Same-origin SSE → backend opens Wings WS with Panel Origin.
      // Direct browser wss://node… is rejected (403) for staff.escapez.be.
      const es = new EventSource(
        consoleStreamUrl(serverIdentifier || undefined),
        { withCredentials: true },
      );
      esRef.current = es;

      es.onmessage = (ev) => {
        let parsed: ConsoleStreamEvent | null = null;
        try {
          parsed = JSON.parse(String(ev.data)) as ConsoleStreamEvent;
        } catch {
          return;
        }
        if (!parsed || typeof parsed !== 'object') return;
        if (parsed.kind === 'ready') {
          setConn('connected');
          setStatusMsg('Verbonden met live console.');
        } else if (parsed.kind === 'line') {
          appendLine(parsed.line);
        } else if (parsed.kind === 'error') {
          setConn('error');
          setStatusMsg(parsed.message || 'Console-fout.');
          es.close();
          esRef.current = null;
        }
        // ping: ignore
      };

      es.onerror = () => {
        setConn((c) => (c === 'connected' ? 'idle' : 'error'));
        if (esRef.current === es) {
          setStatusMsg((m) => m ?? 'Console-verbinding verbroken.');
          es.close();
          esRef.current = null;
        }
      };
    } catch (err) {
      setConn('error');
      setStatusMsg(
        err instanceof ApiError ? err.message : 'Verbinden mislukt.',
      );
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !command.trim() || sending) return;
    setSending(true);
    setStatusMsg(null);
    try {
      const res = await postConsoleCommand(
        command.trim(),
        serverIdentifier || undefined,
      );
      appendLine(`> ${res.command}`);
      if (!res.ok) {
        setStatusMsg(res.message);
      }
      setCommand('');
    } catch (err) {
      setStatusMsg(
        err instanceof ApiError ? err.message : 'Commando verzenden mislukt.',
      );
    } finally {
      setSending(false);
    }
  }

  if (!canRead) {
    return (
      <article className="dash-card">
        <div className="dash-card__head">
          <h2 className="dash-card__title">Live console</h2>
        </div>
        <p className="empty-state">
          Je hebt geen recht <code>console:read</code> om de console te bekijken.
        </p>
      </article>
    );
  }

  if (clientKeyMissing || conn === 'missing_key') {
    return (
      <article className="dash-card">
        <div className="dash-card__head">
          <h2 className="dash-card__title dash-card__title-row">
            <span>Live console</span>
            <HelpTip label="Uitleg console">
              <p>
                De live console gebruikt de Pterodactyl Client API via een
                backend SSE-proxy. De Client API-key en Wings-token blijven op
                de server.
              </p>
            </HelpTip>
          </h2>
        </div>
        <div className="empty-state empty-state--warn">
          <p>
            <strong>Client API-key ontbreekt.</strong>
          </p>
          <p>
            {statusMsg ??
              'Stel een Pterodactyl Client API-key in onder Instellingen om de live console te gebruiken. De key wordt nooit naar de browser gestuurd.'}
          </p>
          <Link className="server-btn server-btn--primary" to="/settings">
            Naar Instellingen → Pterodactyl
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="dash-card console-panel">
      <div className="dash-card__head">
        <h2 className="dash-card__title dash-card__title-row">
          <span>Live console</span>
          <HelpTip label="Uitleg live console">
            <p>
              Stream via backend SSE-proxy naar Wings (Panel Origin). Geen
              Wings-token in de browser. Lezen: <code>console:read</code>.
              Commando&apos;s: <code>console:write</code> of{' '}
              <code>server:command</code>.
            </p>
          </HelpTip>
        </h2>
        <span
          className={
            conn === 'connected'
              ? 'status-pill status-pill--online'
              : conn === 'connecting'
                ? 'status-pill status-pill--loading'
                : 'status-pill status-pill--muted'
          }
        >
          {conn === 'connected'
            ? 'Verbonden'
            : conn === 'connecting'
              ? 'Verbinden…'
              : conn === 'error'
                ? 'Fout'
                : 'Losgekoppeld'}
        </span>
      </div>

      <div className="console-panel__toolbar">
        {conn === 'connected' ? (
          <button
            type="button"
            className="server-btn server-btn--ghost"
            onClick={disconnect}
          >
            Verbreek
          </button>
        ) : (
          <button
            type="button"
            className="server-btn server-btn--primary"
            onClick={() => void connect()}
            disabled={conn === 'connecting'}
          >
            {conn === 'connecting' ? 'Verbinden…' : 'Verbinden'}
          </button>
        )}
        <button
          type="button"
          className="server-chip"
          onClick={() => setLines([])}
          disabled={lines.length === 0}
        >
          Wis scrollback
        </button>
        {serverIdentifier ? (
          <span className="console-panel__target mono">{serverIdentifier}</span>
        ) : (
          <span className="console-panel__target">Default server</span>
        )}
      </div>

      {statusMsg ? (
        <p className="dash-card__hint dash-card__hint--warn">{statusMsg}</p>
      ) : null}

      <div
        className="console-panel__out"
        role="log"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          autoScroll.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {lines.length === 0 ? (
          <div className="console-panel__empty">
            {conn === 'connected'
              ? 'Wachten op console-output…'
              : 'Nog niet verbonden. Klik op Verbinden.'}
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={`${i}-${line.slice(0, 24)}`} className="console-panel__line">
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form className="console-panel__form" onSubmit={onSubmit}>
        <label className="server-label" htmlFor="console-cmd">
          Commando
        </label>
        <div className="console-panel__input-row">
          <input
            id="console-cmd"
            className="server-input"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            maxLength={500}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              canWrite
                ? 'bijv. list'
                : 'Geen schrijfrecht (console:write / server:command)'
            }
            disabled={!canWrite || conn !== 'connected' || sending}
          />
          <button
            type="submit"
            className="server-btn server-btn--primary"
            disabled={
              !canWrite ||
              conn !== 'connected' ||
              sending ||
              !command.trim()
            }
          >
            {sending ? '…' : 'Verstuur'}
          </button>
        </div>
        {!canWrite ? (
          <p className="dash-card__hint">
            Alleen lezen — je mist <code>console:write</code> /{' '}
            <code>server:command</code>.
          </p>
        ) : null}
      </form>
    </article>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchDebugOverview,
  type PteroServerSummary,
} from '../lib/api';
import { HelpTip } from '../components/HelpTip';

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('nl-BE', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Europe/Brussels',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function pteroPowerNl(power: PteroServerSummary['power']): string {
  switch (power) {
    case 'running':
      return 'Online';
    case 'starting':
      return 'Starten…';
    case 'stopping':
      return 'Stoppen…';
    case 'offline':
      return 'Offline';
    default:
      return 'Onbekend';
  }
}

function pteroPowerClass(power: PteroServerSummary['power']): string {
  if (power === 'running') return 'status-pill status-pill--online';
  if (power === 'offline') return 'status-pill status-pill--offline';
  if (power === 'starting' || power === 'stopping') {
    return 'status-pill status-pill--loading';
  }
  return 'status-pill status-pill--muted';
}

function playerCountLabel(s: PteroServerSummary): string {
  if (typeof s.playersOnline === 'number') {
    if (typeof s.maxPlayers === 'number') {
      return `${s.playersOnline} / ${s.maxPlayers}`;
    }
    return String(s.playersOnline);
  }
  return '—';
}

/** Admin-only Ptero / API diagnostics (moved from Dashboard). */
export function DebugPage() {
  const debugQuery = useQuery({
    queryKey: ['debug', 'overview'],
    queryFn: fetchDebugOverview,
    refetchInterval: 20_000,
    retry: false,
  });

  const data = debugQuery.data;
  const status = data?.status;
  const servers = data?.servers;
  const serverItems = servers?.items ?? [];
  const runningCount = serverItems.filter((s) => s.power === 'running').length;
  const hb = data?.bridge?.lastHeartbeat;
  const ptero = data?.pterodactyl;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title page__title-row">
          <span>Debug</span>
          <HelpTip label="Uitleg Debug">
            <p>
              Beheerdersoverzicht van Pterodactyl, API-status en bridge. Vereist{' '}
              <code>debug:view</code> (alleen admin). Geen secrets in responses.
            </p>
          </HelpTip>
        </h1>
        <p className="page__desc">
          Gedetailleerde Ptero- en API-diagnostiek — niet bedoeld voor dagelijkse
          staff-operatie.
        </p>
      </header>

      {debugQuery.isPending ? (
        <p className="empty-state">Debuggegevens laden…</p>
      ) : null}

      {debugQuery.isError ? (
        <div className="empty-state empty-state--warn">
          <p>Debug-overzicht niet bereikbaar (mogelijk 403).</p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="dash-grid">
            <article className="dash-card">
              <div className="dash-card__head">
                <h2 className="dash-card__title">Serverstatus (default)</h2>
                <span
                  className={
                    status?.power === 'online'
                      ? 'status-pill status-pill--online'
                      : status?.power === 'offline'
                        ? 'status-pill status-pill--offline'
                        : 'status-pill status-pill--muted'
                  }
                >
                  {status?.power ?? '—'}
                </span>
              </div>
              <dl className="dash-dl">
                <div>
                  <dt>Bron</dt>
                  <dd>{status?.source ?? '—'}</dd>
                </div>
                <div>
                  <dt>Ptero-state</dt>
                  <dd>{status?.pterodactyl?.state ?? '—'}</dd>
                </div>
                <div>
                  <dt>Stub</dt>
                  <dd>{status?.stub ? 'Ja' : 'Nee'}</dd>
                </div>
                <div>
                  <dt>RCON</dt>
                  <dd>{status?.rconConfigured ? 'Gezet' : 'Niet gezet'}</dd>
                </div>
                <div>
                  <dt>Ptero panel</dt>
                  <dd>{status?.pteroConfigured ? 'Gezet' : 'Niet gezet'}</dd>
                </div>
                <div>
                  <dt>Client API-key</dt>
                  <dd>
                    {data.clientApiKeyConfigured ? 'Gezet' : 'Ontbreekt'}
                  </dd>
                </div>
              </dl>
              {status?.message ? (
                <p className="dash-card__hint dash-card__hint--warn">
                  {status.message}
                </p>
              ) : null}
            </article>

            <article className="dash-card">
              <div className="dash-card__head">
                <h2 className="dash-card__title">Pterodactyl-config (publiek)</h2>
              </div>
              <dl className="dash-dl">
                <div>
                  <dt>Host</dt>
                  <dd className="mono">{ptero?.baseUrlHost ?? '—'}</dd>
                </div>
                <div>
                  <dt>App API-key</dt>
                  <dd className="mono">{ptero?.apiKeyHint ?? '—'}</dd>
                </div>
                <div>
                  <dt>Client API-key</dt>
                  <dd className="mono">{ptero?.clientApiKeyHint ?? '—'}</dd>
                </div>
                <div>
                  <dt>Default server</dt>
                  <dd className="mono">{ptero?.defaultServerIdHint ?? '—'}</dd>
                </div>
                <div>
                  <dt>Bron</dt>
                  <dd>{ptero?.source ?? '—'}</dd>
                </div>
              </dl>
              <p className="dash-card__hint">
                Alleen hints — nooit plaintext keys.{' '}
                <Link to="/settings">Instellingen</Link>
              </p>
            </article>

            <article className="dash-card">
              <div className="dash-card__head">
                <h2 className="dash-card__title">Bridge</h2>
              </div>
              <dl className="dash-dl">
                <div>
                  <dt>Laatste heartbeat</dt>
                  <dd>{formatTimestamp(hb?.receivedAt)}</dd>
                </div>
                <div>
                  <dt>Eventbuffer</dt>
                  <dd>{data.bridge?.bufferSize ?? 0}</dd>
                </div>
              </dl>
            </article>

            <article className="dash-card">
              <div className="dash-card__head">
                <h2 className="dash-card__title">Ptero-serverlijst</h2>
                {servers?.configured ? (
                  <span className="status-pill status-pill--online">
                    {runningCount}/{serverItems.length} online
                  </span>
                ) : (
                  <span className="status-pill status-pill--muted">
                    Niet gezet
                  </span>
                )}
              </div>
              {!servers?.configured ? (
                <p className="dash-card__hint dash-card__hint--warn">
                  {servers?.message ?? 'Niet geconfigureerd.'}{' '}
                  <Link to="/settings">Instellingen</Link>
                </p>
              ) : (
                <dl className="dash-dl">
                  <div>
                    <dt>Aantal</dt>
                    <dd>{serverItems.length}</dd>
                  </div>
                  <div>
                    <dt>Running</dt>
                    <dd>{runningCount}</dd>
                  </div>
                </dl>
              )}
            </article>
          </div>

          <section className="dash-servers" aria-label="Ptero debug servers">
            <div className="dash-servers__head">
              <h2 className="dash-servers__title">Live serverstatus (debug)</h2>
              <p className="dash-servers__desc">
                Ruwe Ptero Application API-lijst — geen secrets.
              </p>
            </div>

            {serverItems.length === 0 ? (
              <p className="empty-state">
                {servers?.message ?? 'Geen servers.'}
              </p>
            ) : (
              <div className="dash-server-grid">
                {serverItems.map((s) => (
                  <article key={s.identifier} className="dash-server-card">
                    <div className="dash-card__head">
                      <h3 className="dash-server-card__name">{s.name}</h3>
                      <span className={pteroPowerClass(s.power)}>
                        {pteroPowerNl(s.power)}
                      </span>
                    </div>
                    <dl className="dash-dl dash-dl--compact">
                      <div>
                        <dt>Identifier</dt>
                        <dd className="mono">{s.identifier}</dd>
                      </div>
                      <div>
                        <dt>UUID</dt>
                        <dd className="mono">{s.uuid || '—'}</dd>
                      </div>
                      <div>
                        <dt>Spelers</dt>
                        <dd>{playerCountLabel(s)}</dd>
                      </div>
                      <div>
                        <dt>Node</dt>
                        <dd>{s.node ?? '—'}</dd>
                      </div>
                      {s.suspended ? (
                        <div>
                          <dt>Status</dt>
                          <dd>Opgeschort</dd>
                        </div>
                      ) : null}
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

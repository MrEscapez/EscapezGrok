import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchBridgeStatus,
  fetchHealth,
  fetchServerList,
  type PteroServerSummary,
} from '../lib/api';
import { useMeQuery } from '../hooks/useMeQuery';
import { LiveFeedWidget } from '../components/LiveFeedWidget';

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

export function DashboardPage() {
  const meQuery = useMeQuery();
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    retry: 1,
  });
  const bridgeQuery = useQuery({
    queryKey: ['bridge', 'status'],
    queryFn: fetchBridgeStatus,
    refetchInterval: 15_000,
    retry: 1,
  });
  const serversQuery = useQuery({
    queryKey: ['server', 'list'],
    queryFn: fetchServerList,
    refetchInterval: 20_000,
    retry: false,
  });

  const online = healthQuery.isSuccess && healthQuery.data?.status === 'ok';
  const offline = healthQuery.isError;
  const loading = healthQuery.isPending;

  let statusLabel = 'Laden…';
  let statusClass = 'status-pill status-pill--loading';
  if (online) {
    statusLabel = 'Online';
    statusClass = 'status-pill status-pill--online';
  } else if (offline) {
    statusLabel = 'Offline';
    statusClass = 'status-pill status-pill--offline';
  }

  const user = meQuery.data;
  const hb = bridgeQuery.data?.lastHeartbeat;
  const hbBody = hb?.body ?? {};
  const coreStatus =
    typeof hbBody.status === 'string' ? hbBody.status : hb ? 'ontvangen' : null;
  const hasHeartbeat = !!hb;

  const servers = serversQuery.data;
  const serverItems = servers?.items ?? [];
  const runningCount = serverItems.filter((s) => s.power === 'running').length;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Dashboard</h1>
        <p className="page__desc">
          Live overzicht van API, Pterodactyl-servers, EscapezCore en sessie.
        </p>
      </header>

      <div className="dash-grid">
        <article className="dash-card">
          <div className="dash-card__head">
            <h2 className="dash-card__title">API-status</h2>
            <span className={statusClass}>{statusLabel}</span>
          </div>
          <dl className="dash-dl">
            <div>
              <dt>Dienst</dt>
              <dd>
                {healthQuery.data?.service ??
                  (loading ? 'Bezig…' : 'Niet bereikbaar')}
              </dd>
            </div>
            <div>
              <dt>Statuscode</dt>
              <dd>{healthQuery.data?.status ?? (offline ? 'fout' : '—')}</dd>
            </div>
            <div>
              <dt>Laatste check</dt>
              <dd>
                {formatTimestamp(
                  healthQuery.data?.timestamp ??
                    (healthQuery.dataUpdatedAt
                      ? new Date(healthQuery.dataUpdatedAt).toISOString()
                      : undefined),
                )}
              </dd>
            </div>
          </dl>
          {offline ? (
            <p className="dash-card__hint dash-card__hint--warn">
              Kan `/api/v1/health` niet bereiken. Controleer of de backend
              draait.
            </p>
          ) : null}
        </article>

        <article className="dash-card">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Sessie</h2>
            <span className="status-pill status-pill--online">Ingelogd</span>
          </div>
          <dl className="dash-dl">
            <div>
              <dt>Gebruiker</dt>
              <dd>{user?.username ?? '—'}</dd>
            </div>
            <div>
              <dt>Gebruikers-ID</dt>
              <dd className="mono">{user?.id ?? '—'}</dd>
            </div>
            <div>
              <dt>Rechten</dt>
              <dd>
                {user?.permissions?.length
                  ? `${user.permissions.length} permissies`
                  : '—'}
              </dd>
            </div>
          </dl>
        </article>

        <article className="dash-card">
          <div className="dash-card__head">
            <h2 className="dash-card__title">EscapezCore heartbeat</h2>
            <span
              className={
                hasHeartbeat
                  ? 'status-pill status-pill--online'
                  : 'status-pill status-pill--muted'
              }
            >
              {hasHeartbeat ? 'Heartbeat' : 'Nog geen'}
            </span>
          </div>
          <dl className="dash-dl">
            <div>
              <dt>Laatst ontvangen</dt>
              <dd>{formatTimestamp(hb?.receivedAt)}</dd>
            </div>
            <div>
              <dt>Serverstatus</dt>
              <dd>{coreStatus ?? '—'}</dd>
            </div>
            <div>
              <dt>Eventbuffer</dt>
              <dd>
                {bridgeQuery.isSuccess
                  ? `${bridgeQuery.data.bufferSize} events`
                  : bridgeQuery.isPending
                    ? 'Laden…'
                    : '—'}
              </dd>
            </div>
          </dl>
          {!hasHeartbeat && bridgeQuery.isSuccess ? (
            <p className="dash-card__hint">
              EscapezCore heeft nog geen heartbeat gepost naar de bridge.
            </p>
          ) : null}
          {bridgeQuery.isError ? (
            <p className="dash-card__hint dash-card__hint--warn">
              Bridge-status niet bereikbaar.
            </p>
          ) : null}
        </article>

        <article className="dash-card">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Pterodactyl-overzicht</h2>
            {servers?.configured ? (
              <span className="status-pill status-pill--online">
                {runningCount}/{serverItems.length} online
              </span>
            ) : (
              <span className="status-pill status-pill--muted">Niet gezet</span>
            )}
          </div>
          {serversQuery.isPending ? (
            <p className="dash-card__hint">Servers laden…</p>
          ) : null}
          {serversQuery.isError ? (
            <p className="dash-card__hint dash-card__hint--warn">
              Serverlijst niet bereikbaar.
            </p>
          ) : null}
          {servers && !servers.configured ? (
            <p className="dash-card__hint dash-card__hint--warn">
              Pterodactyl niet geconfigureerd.{' '}
              <Link to="/settings">Instellingen openen</Link>
            </p>
          ) : null}
          {servers?.configured && serverItems.length === 0 ? (
            <p className="dash-card__hint">
              Geen servers gevonden. Controleer de Ptero-configuratie.
            </p>
          ) : null}
          {servers?.configured && serverItems.length > 0 ? (
            <dl className="dash-dl">
              <div>
                <dt>Aantal servers</dt>
                <dd>{serverItems.length}</dd>
              </div>
              <div>
                <dt>Running</dt>
                <dd>{runningCount}</dd>
              </div>
            </dl>
          ) : null}
          <p className="dash-card__hint">
            <Link to="/server">Naar Servers-pagina →</Link>
          </p>
        </article>
      </div>

      <section className="dash-servers" aria-label="Serverstatus">
        <div className="dash-servers__head">
          <h2 className="dash-servers__title">Live serverstatus</h2>
          <p className="dash-servers__desc">
            Power en spelersaantallen via `/api/v1/server/list` (geen secrets in
            de browser).
          </p>
        </div>

        {serversQuery.isPending ? (
          <p className="empty-state">Serverstatus laden…</p>
        ) : null}

        {servers && !servers.configured ? (
          <div className="empty-state empty-state--compact">
            <p>Pterodactyl is nog niet geconfigureerd.</p>
            <p className="empty-state__sub">
              Voeg base URL en API-keys toe onder{' '}
              <Link to="/settings">Instellingen</Link>. Secrets blijven op de
              backend.
            </p>
          </div>
        ) : null}

        {servers?.configured && serverItems.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <p>Geen Pterodactyl-servers beschikbaar.</p>
            <p className="empty-state__sub">
              {servers.message ??
                'De API is geconfigureerd maar gaf geen servers terug.'}
            </p>
          </div>
        ) : null}

        {serverItems.length > 0 ? (
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
                    <dt>Spelers</dt>
                    <dd>{playerCountLabel(s)}</dd>
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
        ) : null}
      </section>

      <div className="dash-grid dash-grid--feed">
        <LiveFeedWidget enabled={!!user} />
      </div>
    </section>
  );
}

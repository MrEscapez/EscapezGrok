import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchBridgeStatus, fetchHealth, fetchServerList } from '../lib/api';
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
    refetchInterval: 30_000,
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

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Dashboard</h1>
        <p className="page__desc">
          Live overzicht van API-status, EscapezCore heartbeat en sessie.
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
            <h2 className="dash-card__title">Pterodactyl-servers</h2>
          </div>
          {!serversQuery.data?.configured ? (
            <p className="dash-card__hint dash-card__hint--warn">
              Niet geconfigureerd.{' '}
              <Link to="/settings">Instellingen openen</Link>
            </p>
          ) : (
            <dl className="dash-dl">
              <div>
                <dt>Aantal</dt>
                <dd>{serversQuery.data.items.length}</dd>
              </div>
              <div>
                <dt>Online (running)</dt>
                <dd>
                  {
                    serversQuery.data.items.filter((s) => s.power === 'running')
                      .length
                  }
                </dd>
              </div>
            </dl>
          )}
          <p className="dash-card__hint">
            <Link to="/server">Naar Server-pagina</Link>
          </p>
        </article>

        <LiveFeedWidget enabled={!!user} />
      </div>
    </section>
  );
}

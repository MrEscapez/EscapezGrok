import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../lib/api';
import { useMeQuery } from '../hooks/useMeQuery';

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

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Dashboard</h1>
        <p className="page__desc">
          Live overzicht van API-status en ingelogde sessie.
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

        <article className="dash-card dash-card--wide">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Serverstatus</h2>
            <span className="status-pill status-pill--muted">Placeholder</span>
          </div>
          <p className="dash-card__hint">
            Minecraft-serverstatus volgt later via EscapezCore. Geen RCON in
            dit panel.
          </p>
        </article>
      </div>
    </section>
  );
}

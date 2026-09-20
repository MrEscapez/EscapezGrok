import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchBridgeStatus,
  fetchHealth,
  fetchPlayers,
  fetchReports,
  fetchServerList,
  fetchServerStatus,
  fetchTickets,
} from '../lib/api';
import { useCan, useMeQuery } from '../hooks/useMeQuery';
import { LiveFeedWidget } from '../components/LiveFeedWidget';

function StatCard(props: {
  title: string;
  value: string;
  hint?: string;
  pill?: { label: string; className: string };
  to?: string;
  linkLabel?: string;
}) {
  return (
    <article className="dash-card dash-stat">
      <div className="dash-card__head">
        <h2 className="dash-card__title">{props.title}</h2>
        {props.pill ? (
          <span className={props.pill.className}>{props.pill.label}</span>
        ) : null}
      </div>
      <p className="dash-stat__value">{props.value}</p>
      {props.hint ? <p className="dash-card__hint">{props.hint}</p> : null}
      {props.to ? (
        <p className="dash-card__hint">
          <Link to={props.to}>{props.linkLabel ?? 'Bekijken →'}</Link>
        </p>
      ) : null}
    </article>
  );
}

export function DashboardPage() {
  const meQuery = useMeQuery();
  const can = useCan();
  const user = meQuery.data;

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    retry: 1,
  });

  const statusQuery = useQuery({
    queryKey: ['server', 'status'],
    queryFn: fetchServerStatus,
    refetchInterval: 15_000,
    retry: false,
    enabled: can('server:view'),
  });

  const serversQuery = useQuery({
    queryKey: ['server', 'list'],
    queryFn: fetchServerList,
    refetchInterval: 20_000,
    retry: false,
    enabled: can('server:view'),
  });

  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    refetchInterval: 30_000,
    retry: false,
    enabled: can('reports:view'),
  });

  const ticketsQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    refetchInterval: 30_000,
    retry: false,
    enabled: can('tickets:view'),
  });

  const playersQuery = useQuery({
    queryKey: ['players', 'dash'],
    queryFn: () => fetchPlayers(''),
    refetchInterval: 60_000,
    retry: false,
    enabled: can('players:view'),
  });

  const bridgeQuery = useQuery({
    queryKey: ['bridge', 'status'],
    queryFn: fetchBridgeStatus,
    refetchInterval: 20_000,
    retry: false,
  });

  const status = statusQuery.data;
  const serverItems = serversQuery.data?.items ?? [];
  const runningCount = serverItems.filter((s) => s.power === 'running').length;

  const playersLabel =
    status?.playersOnline != null
      ? typeof status.maxPlayers === 'number'
        ? `${status.playersOnline} / ${status.maxPlayers}`
        : String(status.playersOnline)
      : '—';

  const openReports = (reportsQuery.data?.items ?? []).filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'open' || s === 'pending' || s === 'nieuw' || !s;
  }).length;
  const openTickets = (ticketsQuery.data?.items ?? []).filter((t) => {
    const s = (t.status || '').toLowerCase();
    return s === 'open' || s === 'pending' || s === 'nieuw' || !s;
  }).length;

  const playerItems = playersQuery.data?.items ?? [];
  const newPlayersLabel =
    playersQuery.isPending
      ? '…'
      : playerItems.length === 0
        ? 'Geen data'
        : String(playerItems.length);

  const apiOnline =
    healthQuery.isSuccess && healthQuery.data?.status === 'ok';

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Dashboard</h1>
        <p className="page__desc">
          Staff-statistieken — spelers, reports, tickets en serverstatus.
        </p>
      </header>

      <div className="dash-grid dash-grid--stats">
        <StatCard
          title="Online spelers"
          value={
            statusQuery.isPending && can('server:view') ? '…' : playersLabel
          }
          hint={
            !can('server:view')
              ? 'Geen server:view'
              : status?.message && status.playersOnline == null
                ? status.message
                : status?.source
                  ? `Bron: ${status.source}`
                  : 'Nog geen spelerdata'
          }
          pill={
            status?.power === 'online'
              ? { label: 'Server online', className: 'status-pill status-pill--online' }
              : status?.power === 'offline'
                ? {
                    label: 'Server offline',
                    className: 'status-pill status-pill--offline',
                  }
                : {
                    label: 'Status onbekend',
                    className: 'status-pill status-pill--muted',
                  }
          }
          to={can('server:view') ? '/server' : undefined}
          linkLabel="Naar Servers →"
        />

        <StatCard
          title="Open reports"
          value={
            !can('reports:view')
              ? '—'
              : reportsQuery.isPending
                ? '…'
                : String(openReports)
          }
          hint={
            !can('reports:view')
              ? 'Geen reports:view'
              : reportsQuery.data?.items.length === 0
                ? 'Nog geen reports (stub/leeg)'
                : `${reportsQuery.data?.items.length ?? 0} totaal`
          }
          to={can('reports:view') ? '/reports' : undefined}
        />

        <StatCard
          title="Open tickets"
          value={
            !can('tickets:view')
              ? '—'
              : ticketsQuery.isPending
                ? '…'
                : String(openTickets)
          }
          hint={
            !can('tickets:view')
              ? 'Geen tickets:view'
              : ticketsQuery.data?.items.length === 0
                ? 'Nog geen tickets (stub/leeg)'
                : `${ticketsQuery.data?.items.length ?? 0} totaal`
          }
          to={can('tickets:view') ? '/tickets' : undefined}
        />

        <StatCard
          title="Nieuwe spelers"
          value={
            !can('players:view')
              ? '—'
              : newPlayersLabel
          }
          hint={
            !can('players:view')
              ? 'Geen players:view'
              : playerItems.length === 0
                ? 'Spelerlijst leeg — data volgt wanneer de players-API gevuld is'
                : 'Uit players-API'
          }
          to={can('players:view') ? '/players' : undefined}
        />

        <StatCard
          title="Servers online"
          value={
            !can('server:view')
              ? '—'
              : serversQuery.isPending
                ? '…'
                : serversQuery.data && !serversQuery.data.configured
                  ? '—'
                  : `${runningCount} / ${serverItems.length || 0}`
          }
          hint={
            !can('server:view')
              ? 'Geen server:view'
              : serversQuery.data && !serversQuery.data.configured
                ? 'Pterodactyl niet geconfigureerd'
                : 'Running volgens Ptero Client power'
          }
          to={can('server:view') ? '/server' : undefined}
        />

        <StatCard
          title="API / bridge"
          value={apiOnline ? 'OK' : healthQuery.isPending ? '…' : 'Offline'}
          hint={
            bridgeQuery.data?.lastHeartbeat
              ? `Heartbeat: ${bridgeQuery.data.bufferSize} events in buffer`
              : 'Nog geen EscapezCore-heartbeat'
          }
          pill={
            apiOnline
              ? { label: 'API online', className: 'status-pill status-pill--online' }
              : {
                  label: 'API offline',
                  className: 'status-pill status-pill--offline',
                }
          }
        />
      </div>

      <div className="dash-grid dash-grid--feed">
        <LiveFeedWidget enabled={!!user} />
      </div>
    </section>
  );
}

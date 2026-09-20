import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  fetchTicket,
  fetchTickets,
  fetchTicketToolSettings,
  syncTickets,
  type TicketDetail,
  type TicketItem,
} from '../lib/api';
import { can } from '../lib/permissions';
import { useMeQuery } from '../hooks/useMeQuery';

function formatTs(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nl-BE', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Brussels',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'OPEN':
      return 'Open';
    case 'CLOSED':
      return 'Gesloten';
    case 'DELETED':
      return 'Verwijderd';
    default:
      return status || '—';
  }
}

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return 'badge badge--open';
  if (s === 'closed' || s === 'gesloten') return 'badge badge--gesloten';
  return `badge badge--${s || 'unknown'}`;
}

export function TicketsPage() {
  const meQuery = useMeQuery();
  const canManage = can(meQuery.data?.permissions, 'tickets:manage');
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ['settings', 'ticket-tool'],
    queryFn: fetchTicketToolSettings,
    retry: false,
  });

  const listQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ['tickets', selectedId],
    queryFn: () => fetchTicket(selectedId!),
    enabled: Boolean(selectedId),
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: syncTickets,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const configured = Boolean(
    configQuery.data?.configured ||
      configQuery.data?.webhookSecretConfigured ||
      listQuery.data?.configured,
  );

  const items: TicketItem[] = listQuery.data?.items ?? [];
  const detail: TicketDetail | undefined = detailQuery.data;

  const emptyHint = useMemo(() => {
    if (configQuery.isPending || listQuery.isPending) return null;
    if (!configured) {
      return 'Ticket Tool is nog niet geconfigureerd. Ga naar Instellingen om een API-token (tt_…) en webhook-secret in te stellen.';
    }
    if (items.length === 0) {
      return 'Geen tickets in de lokale store. Gebruik Sync of wacht op webhook-events.';
    }
    return null;
  }, [configured, configQuery.isPending, items.length, listQuery.isPending]);

  return (
    <section className="page">
      <header className="page__header page__header--row">
        <div>
          <h1 className="page__title">Tickets</h1>
          <p className="page__desc">
            Discord-supporttickets via Ticket Tool (lokaal + webhook/sync).
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="server-btn server-btn--primary"
            disabled={
              syncMutation.isPending || !configQuery.data?.configured
            }
            title={
              configQuery.data?.configured
                ? 'Haal tickets op via de Ticket Tool API'
                : 'Configureer eerst een API-token onder Instellingen'
            }
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? 'Sync…' : 'Sync met Ticket Tool'}
          </button>
        ) : null}
      </header>

      {syncMutation.isSuccess ? (
        <div className="settings-toast settings-toast--ok" role="status">
          {syncMutation.data.message}
        </div>
      ) : null}
      {syncMutation.isError ? (
        <div className="settings-toast settings-toast--error" role="status">
          {syncMutation.error instanceof ApiError
            ? syncMutation.error.message
            : 'Sync mislukt.'}
        </div>
      ) : null}

      <div className="page__card">
        {listQuery.isPending || configQuery.isPending ? (
          <p className="empty-state">Tickets laden…</p>
        ) : null}

        {listQuery.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {listQuery.error instanceof ApiError
                ? listQuery.error.message
                : 'Kan tickets niet laden.'}
            </p>
          </div>
        ) : null}

        {emptyHint ? (
          <div className="empty-state">
            <p>{emptyHint}</p>
          </div>
        ) : null}

        {listQuery.isSuccess && items.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Onderwerp</th>
                  <th>Speler</th>
                  <th>Status</th>
                  <th>Toegewezen</th>
                  <th>Bijgewerkt</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr
                    key={t.id}
                    className={
                      selectedId === t.id ? 'data-table__row--active' : ''
                    }
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <td className="mono">
                      {t.ticketNumber != null
                        ? `#${t.ticketNumber}`
                        : t.id.slice(0, 8)}
                    </td>
                    <td>{t.subject || '—'}</td>
                    <td>{t.player || '—'}</td>
                    <td>
                      <span className={statusBadgeClass(t.status)}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td>{t.claimedBy || '—'}</td>
                    <td>{formatTs(t.updatedAt || t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedId ? (
        <>
          <button
            type="button"
            className="ticket-drawer-backdrop"
            aria-label="Sluit ticketdetail"
            onClick={() => setSelectedId(null)}
          />
          <aside className="ticket-drawer" aria-label="Ticketdetail">
            <header className="ticket-drawer__header">
              <h2 className="ticket-drawer__title">
                {detail?.subject || 'Ticket'}
              </h2>
              <button
                type="button"
                className="server-btn"
                onClick={() => setSelectedId(null)}
              >
                Sluiten
              </button>
            </header>

            {detailQuery.isPending ? (
              <p className="empty-state">Detail laden…</p>
            ) : null}
            {detailQuery.isError ? (
              <div className="empty-state empty-state--warn">
                <p>
                  {detailQuery.error instanceof ApiError
                    ? detailQuery.error.message
                    : 'Kan ticketdetail niet laden.'}
                </p>
              </div>
            ) : null}

            {detail ? (
              <div className="ticket-drawer__body">
                <dl className="dash-dl">
                  <div>
                    <dt>Nummer</dt>
                    <dd>
                      {detail.ticketNumber != null
                        ? `#${detail.ticketNumber}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={statusBadgeClass(detail.status)}>
                        {statusLabel(detail.status)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Speler</dt>
                    <dd>{detail.player || '—'}</dd>
                  </div>
                  <div>
                    <dt>Toegewezen</dt>
                    <dd>{detail.claimedBy || '—'}</dd>
                  </div>
                  <div>
                    <dt>Prioriteit</dt>
                    <dd>{detail.priority || '—'}</dd>
                  </div>
                  <div>
                    <dt>Aangemaakt</dt>
                    <dd>{formatTs(detail.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Bijgewerkt</dt>
                    <dd>{formatTs(detail.updatedAt)}</dd>
                  </div>
                </dl>

                <h3 className="ticket-drawer__section">Berichten</h3>
                {detail.messages.length === 0 ? (
                  <p className="empty-state">Nog geen berichten opgeslagen.</p>
                ) : (
                  <ul className="ticket-messages">
                    {detail.messages.map((m) => (
                      <li key={m.id} className="ticket-messages__item">
                        <div className="ticket-messages__meta">
                          <strong>{m.author}</strong>
                          <span>{formatTs(m.createdAt)}</span>
                        </div>
                        <p className="ticket-messages__content">{m.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </section>
  );
}

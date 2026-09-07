import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchTickets, type TicketItem } from '../lib/api';

const DEMO_PLACEHOLDERS: TicketItem[] = [
  {
    id: 'demo-t1',
    subject: 'Demo — hulp bij claim',
    player: 'VoorbeeldSpeler',
    status: 'open',
    createdAt: '2026-09-02T11:00:00.000Z',
  },
  {
    id: 'demo-t2',
    subject: 'Demo — shopvraag',
    player: 'DemoUser',
    status: 'in_behandeling',
    createdAt: '2026-09-04T16:20:00.000Z',
  },
  {
    id: 'demo-t3',
    subject: 'Demo — overig',
    player: 'TestAccount',
    status: 'gesloten',
    createdAt: '2026-09-06T08:45:00.000Z',
  },
];

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
  switch (status) {
    case 'open':
      return 'Open';
    case 'in_behandeling':
      return 'In behandeling';
    case 'gesloten':
      return 'Gesloten';
    default:
      return status;
  }
}

export function TicketsPage() {
  const query = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    retry: false,
  });

  const apiItems = query.data?.items ?? [];
  const showDemo = query.isSuccess && apiItems.length === 0;
  const rows = showDemo ? DEMO_PLACEHOLDERS : apiItems;
  const usingDemo = showDemo || query.isError;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Tickets</h1>
        <p className="page__desc">
          Supporttickets (stub — nog geen ticketstore).
        </p>
      </header>

      <div className="page__card">
        {query.isPending ? <p className="empty-state">Tickets laden…</p> : null}

        {query.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {query.error instanceof ApiError
                ? query.error.message
                : 'Kan tickets niet laden.'}
            </p>
            <p className="empty-state__sub">
              Demo-placeholders blijven zichtbaar voor de tabel-layout.
            </p>
          </div>
        ) : null}

        {(query.isSuccess || query.isError) && (
          <>
            {usingDemo ? (
              <p className="demo-banner" role="note">
                Demo-placeholders — geen echte tickets. API gaf een lege
                lijst{query.isError ? ' of een fout' : ''}.
              </p>
            ) : null}

            {rows.length === 0 && !usingDemo ? (
              <div className="empty-state">
                <p>Geen tickets gevonden.</p>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Onderwerp</th>
                      <th>Speler</th>
                      <th>Status</th>
                      <th>Aangemaakt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(query.isError ? DEMO_PLACEHOLDERS : rows).map((t) => (
                      <tr
                        key={t.id}
                        className={
                          t.id.startsWith('demo-') ? 'data-table__row--demo' : ''
                        }
                      >
                        <td className="mono">{t.id}</td>
                        <td>{t.subject}</td>
                        <td>{t.player}</td>
                        <td>
                          <span className={`badge badge--${t.status}`}>
                            {statusLabel(t.status)}
                          </span>
                        </td>
                        <td>{formatTs(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

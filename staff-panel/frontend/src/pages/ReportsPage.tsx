import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchReports, type ReportItem } from '../lib/api';

/** Duidelijk gemarkeerde demo-rijen — geen echte data */
const DEMO_PLACEHOLDERS: ReportItem[] = [
  {
    id: 'demo-1',
    player: 'VoorbeeldSpeler',
    reason: 'Demo — griefing (placeholder)',
    status: 'open',
    createdAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'demo-2',
    player: 'DemoUser',
    reason: 'Demo — chatmisbruik (placeholder)',
    status: 'in_behandeling',
    createdAt: '2026-09-03T14:30:00.000Z',
  },
  {
    id: 'demo-3',
    player: 'TestAccount',
    reason: 'Demo — overig (placeholder)',
    status: 'gesloten',
    createdAt: '2026-09-05T09:15:00.000Z',
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

export function ReportsPage() {
  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
    retry: false,
  });

  const apiItems = reportsQuery.data?.items ?? [];
  const showDemo =
    reportsQuery.isSuccess && apiItems.length === 0;
  const rows = showDemo ? DEMO_PLACEHOLDERS : apiItems;
  const usingDemo = showDemo;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Reports</h1>
        <p className="page__desc">
          Inkomende reports van spelers (layout klaar voor EscapezCore).
        </p>
      </header>

      <div className="page__card">
        {reportsQuery.isPending ? (
          <p className="empty-state">Reports laden…</p>
        ) : null}

        {reportsQuery.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {reportsQuery.error instanceof ApiError
                ? reportsQuery.error.message
                : 'Kan reports niet laden.'}
            </p>
            <p className="empty-state__sub">
              Toon hieronder demo-placeholders zodat de tabel-layout zichtbaar
              blijft.
            </p>
          </div>
        ) : null}

        {(reportsQuery.isSuccess || reportsQuery.isError) && (
          <>
            {usingDemo || reportsQuery.isError ? (
              <p className="demo-banner" role="note">
                Demo-placeholders — geen echte spelerdata. API gaf een lege
                lijst{reportsQuery.isError ? ' of een fout' : ''}.
              </p>
            ) : null}

            {rows.length === 0 && !usingDemo ? (
              <div className="empty-state">
                <p>Geen reports gevonden.</p>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Speler</th>
                      <th>Reden</th>
                      <th>Status</th>
                      <th>Aangemaakt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportsQuery.isError ? DEMO_PLACEHOLDERS : rows).map(
                      (r) => (
                        <tr
                          key={r.id}
                          className={
                            r.id.startsWith('demo-') ? 'data-table__row--demo' : ''
                          }
                        >
                          <td className="mono">{r.id}</td>
                          <td>{r.player}</td>
                          <td>{r.reason}</td>
                          <td>
                            <span className={`badge badge--${r.status}`}>
                              {statusLabel(r.status)}
                            </span>
                          </td>
                          <td>{formatTs(r.createdAt)}</td>
                        </tr>
                      ),
                    )}
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

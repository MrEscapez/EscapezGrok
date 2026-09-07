import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchPunishments, type PunishmentItem } from '../lib/api';

const DEMO_PLACEHOLDERS: PunishmentItem[] = [
  {
    id: 'demo-ban-1',
    player: 'VoorbeeldSpeler',
    type: 'ban',
    reason: 'Demo — griefing (placeholder)',
    staff: 'ModeratorDemo',
    until: '2026-12-01T00:00:00.000Z',
    status: 'actief',
  },
  {
    id: 'demo-mute-1',
    player: 'DemoUser',
    type: 'mute',
    reason: 'Demo — chatmisbruik (placeholder)',
    staff: 'HelperDemo',
    until: '2026-09-15T18:00:00.000Z',
    status: 'actief',
  },
  {
    id: 'demo-warn-1',
    player: 'TestAccount',
    type: 'warn',
    reason: 'Demo — waarschuwing (placeholder)',
    staff: 'AdminDemo',
    until: null,
    status: 'gesloten',
  },
];

function formatTs(iso: string | null): string {
  if (!iso) return 'Permanent';
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

function typeLabel(type: string): string {
  switch (type) {
    case 'ban':
      return 'Ban';
    case 'mute':
      return 'Mute';
    case 'warn':
      return 'Warn';
    default:
      return type;
  }
}

export function PunishmentsPage() {
  const query = useQuery({
    queryKey: ['punishments'],
    queryFn: fetchPunishments,
    retry: false,
  });

  const apiItems = query.data?.items ?? [];
  const showDemo = query.isSuccess && apiItems.length === 0;
  const rows = showDemo ? DEMO_PLACEHOLDERS : apiItems;
  const usingDemo = showDemo || query.isError;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Straffen</h1>
        <p className="page__desc">
          Bans, mutes en warnings (stub — geen LiteBans-koppeling).
        </p>
      </header>

      <div className="page__card">
        {query.isPending ? <p className="empty-state">Straffen laden…</p> : null}

        {query.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {query.error instanceof ApiError
                ? query.error.message
                : 'Kan straffen niet laden.'}
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
                Demo-placeholders — geen echte moderatiedata. API gaf een lege
                lijst{query.isError ? ' of een fout' : ''}.
              </p>
            ) : null}

            {rows.length === 0 && !usingDemo ? (
              <div className="empty-state">
                <p>Geen straffen gevonden.</p>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Speler</th>
                      <th>Type</th>
                      <th>Reden</th>
                      <th>Staff</th>
                      <th>Tot</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(query.isError ? DEMO_PLACEHOLDERS : rows).map((p) => (
                      <tr
                        key={p.id}
                        className={
                          p.id.startsWith('demo-') ? 'data-table__row--demo' : ''
                        }
                      >
                        <td>{p.player}</td>
                        <td>
                          <span className={`badge badge--${p.type}`}>
                            {typeLabel(p.type)}
                          </span>
                        </td>
                        <td>{p.reason}</td>
                        <td>{p.staff}</td>
                        <td>{formatTs(p.until)}</td>
                        <td>
                          <span className={`badge badge--${p.status}`}>
                            {p.status}
                          </span>
                        </td>
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

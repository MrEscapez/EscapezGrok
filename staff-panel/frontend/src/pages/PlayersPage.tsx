import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchPlayers } from '../lib/api';

export function PlayersPage() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');

  const playersQuery = useQuery({
    queryKey: ['players', query],
    queryFn: () => fetchPlayers(query),
    enabled: true,
    retry: false,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery(draft.trim());
  }

  const items = playersQuery.data?.items ?? [];
  const is404 =
    playersQuery.isError &&
    playersQuery.error instanceof ApiError &&
    playersQuery.error.status === 404;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Spelers</h1>
        <p className="page__desc">
          Zoek spelers op naam (stub-API — nog geen live EscapezCore-data).
        </p>
      </header>

      <form className="search-bar" onSubmit={onSubmit}>
        <label className="search-bar__field">
          <span className="sr-only">Zoekterm</span>
          <input
            type="search"
            name="q"
            placeholder="Zoek op spelersnaam…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" className="search-bar__btn" disabled={playersQuery.isFetching}>
          {playersQuery.isFetching ? 'Zoeken…' : 'Zoeken'}
        </button>
      </form>

      <div className="page__card">
        {playersQuery.isPending ? (
          <p className="empty-state">Spelers laden…</p>
        ) : null}

        {playersQuery.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {is404
                ? 'Spelers-endpoint niet beschikbaar (404).'
                : playersQuery.error instanceof ApiError
                  ? playersQuery.error.message
                  : 'Kan spelers niet laden.'}
            </p>
            <p className="empty-state__sub">
              Probeer later opnieuw of controleer of de API draait.
            </p>
          </div>
        ) : null}

        {playersQuery.isSuccess && items.length === 0 ? (
          <div className="empty-state">
            <p>
              {query
                ? `Geen spelers gevonden voor “${query}”.`
                : 'Nog geen spelers in de stub-API.'}
            </p>
            <p className="empty-state__sub">
              Live data volgt wanneer EscapezCore/Postgres is aangesloten.
            </p>
          </div>
        ) : null}

        {playersQuery.isSuccess && items.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Speler</th>
                  <th>UUID</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.id}</td>
                    <td>{p.username}</td>
                    <td className="mono">{p.uuid ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

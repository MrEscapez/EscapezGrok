import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCan } from '../hooks/useMeQuery';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  fetchSafeRconCommands,
  fetchServerList,
  fetchServerStatus,
  postServerPower,
  postServerRcon,
  type ServerPowerAction,
  type ServerStatus,
} from '../lib/api';
import { HelpTip } from '../components/HelpTip';

const POWER_LABELS: Record<ServerPowerAction, string> = {
  start: 'Starten',
  stop: 'Stoppen',
  restart: 'Herstarten',
};

function powerPillClass(power: ServerStatus['power']): string {
  if (power === 'online') return 'status-pill status-pill--online';
  if (power === 'offline') return 'status-pill status-pill--offline';
  return 'status-pill status-pill--loading';
}

function powerLabelNl(power: ServerStatus['power']): string {
  if (power === 'online') return 'Online';
  if (power === 'offline') return 'Offline';
  return 'Onbekend';
}

function pteroPowerNl(power: string): string {
  switch (power) {
    case 'running':
      return 'Running';
    case 'starting':
      return 'Starting';
    case 'stopping':
      return 'Stopping';
    case 'offline':
      return 'Offline';
    default:
      return 'Onbekend';
  }
}

type Feedback = { kind: 'ok' | 'warn' | 'error'; message: string };

export function ServerPage() {
  const can = useCan();
  const canPower = can('server:power');
  const canCommand = can('server:command');
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmAction, setConfirmAction] = useState<ServerPowerAction | null>(
    null,
  );
  const [powerTarget, setPowerTarget] = useState<string | undefined>(undefined);
  const [rconCommand, setRconCommand] = useState('list');
  const [rconConfirm, setRconConfirm] = useState(false);
  const [rconOutput, setRconOutput] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['server', 'status'],
    queryFn: fetchServerStatus,
    refetchInterval: 15_000,
    retry: false,
  });

  const listQuery = useQuery({
    queryKey: ['server', 'list'],
    queryFn: fetchServerList,
    refetchInterval: 20_000,
    retry: false,
  });

  const safeQuery = useQuery({
    queryKey: ['server', 'safe-commands'],
    queryFn: fetchSafeRconCommands,
    staleTime: 60_000,
    retry: false,
  });

  const status = statusQuery.data;
  const list = listQuery.data;
  const safeCommands = safeQuery.data?.commands ?? ['list', 'tps', 'help'];

  const isSafeSelected = useMemo(() => {
    const cmd = rconCommand.trim().toLowerCase();
    return safeCommands.some((c) => c.toLowerCase() === cmd);
  }, [rconCommand, safeCommands]);

  const powerMutation = useMutation({
    mutationFn: (action: ServerPowerAction) =>
      postServerPower(action, true, powerTarget),
    onMutate: () => setFeedback(null),
    onSuccess: (data) => {
      setConfirmAction(null);
      setPowerTarget(undefined);
      setFeedback({
        kind: data.stub ? 'warn' : data.ok ? 'ok' : 'error',
        message: data.message,
      });
      void queryClient.invalidateQueries({ queryKey: ['server'] });
    },
    onError: (err) => {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError ? err.message : 'Power-actie mislukt.',
      });
    },
  });

  const rconMutation = useMutation({
    mutationFn: () =>
      postServerRcon(
        rconCommand.trim(),
        isSafeSelected ? undefined : rconConfirm ? true : undefined,
      ),
    onMutate: () => {
      setFeedback(null);
      setRconOutput(null);
    },
    onSuccess: (data) => {
      setRconOutput(
        [data.message, data.response ? `Antwoord:\n${data.response}` : '']
          .filter(Boolean)
          .join('\n\n'),
      );
      setFeedback({
        kind: data.ok ? 'ok' : 'warn',
        message: data.message,
      });
      void queryClient.invalidateQueries({ queryKey: ['server', 'status'] });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.message : 'RCON-commando mislukt.';
      setFeedback({ kind: 'error', message: msg });
      setRconOutput(msg);
    },
  });

  function onRconSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rconCommand.trim()) return;
    if (!isSafeSelected && !rconConfirm) {
      setFeedback({
        kind: 'warn',
        message:
          'Dit commando staat niet op de veilige allowlist. Vink bevestiging aan of kies list/tps.',
      });
      return;
    }
    rconMutation.mutate();
  }

  function requestPower(action: ServerPowerAction, identifier?: string) {
    setPowerTarget(identifier);
    setConfirmAction(action);
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title page__title-row">
          <span>Server</span>
          <HelpTip label="Uitleg Server-pagina" wide>
            <p>
              Status komt van Pterodactyl en/of RCON-stubs. Power start/stop/restart
              vereist permissie <code>server:power</code>. RCON-commando&apos;s
              vereisen <code>server:command</code>; veilige allowlist (list/tps)
              zonder extra bevestiging.
            </p>
            <p>
              Geheimen (RCON/Ptero) staan alleen in de backend-omgeving — nooit in
              deze UI of in Vite-env.
            </p>
          </HelpTip>
        </h1>
        <p className="page__desc">
          Pterodactyl-serverlijst, power-acties en veilige RCON. Credentials
          blijven op de backend — hier zie je nooit wachtwoorden of API-keys.
        </p>
      </header>

      {feedback && (
        <div
          className={`server-feedback server-feedback--${feedback.kind}`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      <article className="dash-card server-card--list">
        <div className="dash-card__head">
          <h2 className="dash-card__title dash-card__title-row">
            <span>Alle servers (Pterodactyl)</span>
            <HelpTip label="Uitleg serverlijst">
              <p>
                Lijst via Pterodactyl Application API. Status/power per rij.
                Acties vereisen <code>server:power</code>. Configureer credentials
                onder Instellingen.
              </p>
            </HelpTip>
          </h2>
        </div>

        {listQuery.isPending ? (
          <p className="empty-state">Servers laden…</p>
        ) : null}

        {list && !list.configured ? (
          <div className="empty-state empty-state--warn">
            <p>
              {list.message ??
                'Geen Pterodactyl-credentials. Configureer panel-URL en API-key.'}
            </p>
            <Link className="server-btn server-btn--primary" to="/settings">
              Naar Instellingen
            </Link>
          </div>
        ) : null}

        {list?.configured && list.items.length === 0 ? (
          <div className="empty-state">
            <p>{list.message ?? 'Geen servers gevonden.'}</p>
          </div>
        ) : null}

        {list?.configured && list.items.length > 0 ? (
          <div className="server-table-wrap">
            <table className="server-table">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Status</th>
                  <th>Power</th>
                  <th>Spelers</th>
                  <th>Acties</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((s) => (
                  <tr key={String(s.identifier || s.id)}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="server-table__sub mono">
                        {s.identifier}
                      </div>
                    </td>
                    <td>
                      {s.suspended
                        ? 'Suspended'
                        : s.status
                          ? s.status
                          : '—'}
                    </td>
                    <td>{pteroPowerNl(s.power)}</td>
                    <td>
                      {s.playersOnline != null
                        ? `${s.playersOnline}${
                            s.maxPlayers != null ? ` / ${s.maxPlayers}` : ''
                          }`
                        : '—'}
                    </td>
                    <td>
                      <div className="server-table__actions">
                        <button
                          type="button"
                          className="server-chip"
                          onClick={() =>
                            requestPower('restart', s.identifier)
                          }
                        >
                          Herstart
                        </button>
                        <button
                          type="button"
                          className="server-chip"
                          onClick={() => requestPower('stop', s.identifier)}
                        >
                          Stop
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <div className="server-grid">
        <article className="dash-card">
          <div className="dash-card__head">
            <h2 className="dash-card__title dash-card__title-row">
              <span>Power-status (default)</span>
              <HelpTip label="Uitleg power-status">
                <p>
                  Toont of de default-server online/offline is (bron: Ptero of stub).
                  Power-knoppen vragen om bevestiging en checken <code>server:power</code>.
                </p>
              </HelpTip>
            </h2>
            {status ? (
              <span className={powerPillClass(status.power)}>
                {powerLabelNl(status.power)}
              </span>
            ) : (
              <span className="status-pill status-pill--loading">Laden…</span>
            )}
          </div>
          <dl className="dash-dl">
            <div>
              <dt>Bron</dt>
              <dd>{status?.source ?? '—'}</dd>
            </div>
            <div>
              <dt>Spelers</dt>
              <dd>
                {status?.playersOnline != null
                  ? `${status.playersOnline}${
                      status.maxPlayers != null
                        ? ` / ${status.maxPlayers}`
                        : ''
                    }`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Pterodactyl-state</dt>
              <dd>{status?.pterodactyl?.state ?? '—'}</dd>
            </div>
          </dl>
          {status?.message && (
            <p className="dash-card__hint dash-card__hint--warn">
              {status.message}
            </p>
          )}
        </article>

        <article className="dash-card">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Integraties</h2>
          </div>
          <dl className="dash-dl">
            <div>
              <dt>RCON geconfigureerd</dt>
              <dd>
                <span
                  className={
                    status?.rconConfigured
                      ? 'server-badge server-badge--yes'
                      : 'server-badge server-badge--no'
                  }
                >
                  {status?.rconConfigured ? 'Ja' : 'Nee (stub)'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Pterodactyl geconfigureerd</dt>
              <dd>
                <span
                  className={
                    status?.pteroConfigured
                      ? 'server-badge server-badge--yes'
                      : 'server-badge server-badge--no'
                  }
                >
                  {status?.pteroConfigured ? 'Ja' : 'Nee (stub)'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Modus</dt>
              <dd>{status?.stub ? 'Stub / demo' : 'Live adapter'}</dd>
            </div>
          </dl>
          <p className="dash-card__hint">
            Credentials instellen via{' '}
            <Link to="/settings">Instellingen → Pterodactyl</Link> of backend{' '}
            <code>.env</code>.
          </p>
        </article>
      </div>

      <article className="dash-card server-card--actions">
        <div className="dash-card__head">
          <h2 className="dash-card__title dash-card__title-row">
            <span>Power-acties (default server)</span>
            <HelpTip label="Uitleg power-acties">
              <p>
                Start/stop/restart van de default-server via Pterodactyl Client API.
                Bevestigingsdialoog verplicht. Permissie: <code>server:power</code>.
              </p>
            </HelpTip>
          </h2>
        </div>
        <p className="dash-card__hint">
          Stoppen en herstarten vereisen bevestiging + recht{' '}
          <code>server:power</code>.
        </p>
        <div className="server-power-btns">
          {(['start', 'stop', 'restart'] as ServerPowerAction[]).map(
            (action) => (
              <button
                key={action}
                type="button"
                className={
                  action === 'start'
                    ? 'server-btn server-btn--start'
                    : action === 'stop'
                      ? 'server-btn server-btn--stop'
                      : 'server-btn server-btn--restart'
                }
                onClick={() => requestPower(action)}
                disabled={powerMutation.isPending || !canPower}
              >
                {POWER_LABELS[action]}
              </button>
            ),
          )}
        </div>
      </article>

      <article className="dash-card">
        <div className="dash-card__head">
          <h2 className="dash-card__title dash-card__title-row">
              <span>RCON-commando</span>
              <HelpTip label="Uitleg RCON">
                <p>
                  Stuurt een Minecraft-consolecommando via backend-RCON.
                  Vereist <code>server:command</code>. Denylist-commando&apos;s
                  vragen om bevestiging. Zonder RCON_* in backend: stub (503/boodschap).
                </p>
              </HelpTip>
            </h2>
        </div>
        <p className="dash-card__hint">
          Veilige allowlist zonder extra bevestiging:{' '}
          {safeCommands.map((c) => (
            <button
              key={c}
              type="button"
              className="server-chip"
              onClick={() => {
                setRconCommand(c);
                setRconConfirm(false);
              }}
            >
              {c}
            </button>
          ))}
        </p>
        <form className="server-rcon-form" onSubmit={onRconSubmit}>
          <label className="server-label" htmlFor="rcon-cmd">
            Commando
          </label>
          <input
            id="rcon-cmd"
            className="server-input"
            value={rconCommand}
            onChange={(e) => setRconCommand(e.target.value)}
            maxLength={256}
            autoComplete="off"
            spellCheck={false}
            placeholder="list"
          />
          {!isSafeSelected && (
            <label className="server-check">
              <input
                type="checkbox"
                checked={rconConfirm}
                onChange={(e) => setRconConfirm(e.target.checked)}
              />
              Ik bevestig dit gevaarlijke/onbekende commando (
              <code>confirm: true</code>)
            </label>
          )}
          <button
            type="submit"
            className="server-btn server-btn--primary"
            disabled={rconMutation.isPending || !rconCommand.trim() || !canCommand}
          >
            {rconMutation.isPending ? 'Verzenden…' : 'Verstuur RCON'}
          </button>
        </form>
        {rconOutput && (
          <pre className="server-rcon-out" aria-live="polite">
            {rconOutput}
          </pre>
        )}
      </article>

      {confirmAction && (
        <div className="server-modal" role="dialog" aria-modal="true">
          <div className="server-modal__card">
            <h3 className="server-modal__title">
              Bevestig: {POWER_LABELS[confirmAction]}
            </h3>
            <p className="server-modal__body">
              Weet je zeker dat je
              {powerTarget ? (
                <>
                  {' '}
                  server <code>{powerTarget}</code>
                </>
              ) : (
                ' de default server'
              )}{' '}
              wilt{' '}
              <strong>{POWER_LABELS[confirmAction].toLowerCase()}</strong>? Dit
              stuurt <code>confirm: true</code> naar de API.
            </p>
            <div className="server-modal__actions">
              <button
                type="button"
                className="server-btn server-btn--ghost"
                onClick={() => {
                  setConfirmAction(null);
                  setPowerTarget(undefined);
                }}
                disabled={powerMutation.isPending || !canPower}
              >
                Annuleren
              </button>
              <button
                type="button"
                className="server-btn server-btn--stop"
                onClick={() => powerMutation.mutate(confirmAction)}
                disabled={powerMutation.isPending || !canPower}
              >
                {powerMutation.isPending
                  ? 'Bezig…'
                  : `Ja, ${POWER_LABELS[confirmAction].toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

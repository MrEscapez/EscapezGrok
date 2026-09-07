import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  fetchBridgeStatus,
  fetchPteroSettings,
  fetchSettingsModules,
  patchSettingsModule,
  savePteroSettings,
  testPteroConnection,
  type ModulePatchResponse,
  type ModuleSource,
  type ModuleStatus,
  type PteroPublicConfig,
} from '../lib/api';
import { HelpTip, LabelWithHelp } from '../components/HelpTip';

const MODULE_DESCRIPTIONS: Record<string, string> = {
  scoreboard: 'Sidebar-scoreboard voor spelers.',
  tips: 'Periodieke tips in chat.',
  vote: 'Herinneringen om te stemmen.',
  resourcepack: 'Resourcepack-aanbod / enforce.',
  reports: 'In-game report-systeem.',
  staffchat: 'Staff-only chatkanaal.',
  items: 'Custom items / item-API.',
};

function sourceLabel(source: ModuleSource): string {
  switch (source) {
    case 'core':
      return 'Gesynchroniseerd met Core';
    case 'pending':
      return 'Lokaal opgeslagen — sync pending';
    case 'local':
    default:
      return 'Lokaal opgeslagen';
  }
}

function sourceBadgeClass(source: ModuleSource): string {
  switch (source) {
    case 'core':
      return 'module-source module-source--core';
    case 'pending':
      return 'module-source module-source--pending';
    default:
      return 'module-source module-source--local';
  }
}

type Feedback = {
  kind: 'ok' | 'warn' | 'error';
  message: string;
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clientApiKey, setClientApiKey] = useState('');
  const [defaultServerId, setDefaultServerId] = useState('');
  const [pteroHydrated, setPteroHydrated] = useState(false);

  const modulesQuery = useQuery({
    queryKey: ['settings', 'modules'],
    queryFn: fetchSettingsModules,
    retry: false,
  });

  const bridgeQuery = useQuery({
    queryKey: ['bridge', 'status'],
    queryFn: fetchBridgeStatus,
    refetchInterval: 20_000,
    retry: false,
  });

  const pteroQuery = useQuery({
    queryKey: ['settings', 'pterodactyl'],
    queryFn: fetchPteroSettings,
    retry: false,
  });

  useEffect(() => {
    if (!pteroQuery.data || pteroHydrated) return;
    const cfg = pteroQuery.data;
    setBaseUrl(cfg.baseUrlHost ? `https://${cfg.baseUrlHost}` : '');
    setDefaultServerId('');
    setPteroHydrated(true);
  }, [pteroQuery.data, pteroHydrated]);

  const coreOnline = !!bridgeQuery.data?.lastHeartbeat;
  const coreOffline =
    bridgeQuery.isSuccess && !bridgeQuery.data?.lastHeartbeat;

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      patchSettingsModule(id, enabled),
    onMutate: async ({ id, enabled }) => {
      setFeedback(null);
      await queryClient.cancelQueries({ queryKey: ['settings', 'modules'] });
      const previous = queryClient.getQueryData<{ modules: ModuleStatus[] }>([
        'settings',
        'modules',
      ]);
      if (previous) {
        queryClient.setQueryData(['settings', 'modules'], {
          modules: previous.modules.map((m) =>
            m.id === id
              ? { ...m, enabled, source: 'pending' as ModuleSource }
              : m,
          ),
        });
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['settings', 'modules'], ctx.previous);
      }
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError
            ? err.message
            : 'Toggle mislukt — wijziging teruggedraaid.',
      });
    },
    onSuccess: (data: ModulePatchResponse) => {
      queryClient.setQueryData(
        ['settings', 'modules'],
        (old: { modules: ModuleStatus[] } | undefined) => {
          if (!old) {
            return { modules: [data] };
          }
          return {
            modules: old.modules.map((m) =>
              m.id === data.id
                ? {
                    id: data.id,
                    label: data.label,
                    enabled: data.enabled,
                    source: data.source,
                  }
                : m,
            ),
          };
        },
      );

      const syncHint =
        data.syncStatus === 'synced'
          ? 'Gesynchroniseerd met EscapezCore.'
          : data.syncStatus === 'pending'
            ? 'Lokaal opgeslagen — sync met EscapezCore pending.'
            : 'Lokaal opgeslagen.';

      setFeedback({
        kind: data.syncStatus === 'synced' ? 'ok' : 'warn',
        message: `${data.label}: ${data.enabled ? 'aan' : 'uit'}. ${data.note} ${syncHint}`,
      });
    },
  });

  const savePteroMutation = useMutation({
    mutationFn: () =>
      savePteroSettings({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        clientApiKey: clientApiKey.trim() || undefined,
        defaultServerId: defaultServerId.trim(),
      }),
    onSuccess: (data: PteroPublicConfig) => {
      setApiKey('');
      setClientApiKey('');
      void queryClient.invalidateQueries({
        queryKey: ['settings', 'pterodactyl'],
      });
      void queryClient.invalidateQueries({ queryKey: ['server'] });
      setFeedback({
        kind: data.configured ? 'ok' : 'warn',
        message: data.configured
          ? `Pterodactyl opgeslagen (${data.baseUrlHost ?? 'host'}). API-key blijft write-only op de backend.`
          : 'Opgeslagen, maar panel nog niet volledig geconfigureerd.',
      });
    },
    onError: (err) => {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError
            ? err.message
            : 'Pterodactyl-instellingen opslaan mislukt.',
      });
    },
  });

  const testPteroMutation = useMutation({
    mutationFn: testPteroConnection,
    onSuccess: (data) => {
      setFeedback({
        kind: data.ok ? 'ok' : 'error',
        message: data.message,
      });
    },
    onError: (err) => {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError
            ? err.message
            : 'Verbindingstest mislukt.',
      });
    },
  });

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 8000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const modules = modulesQuery.data?.modules ?? [];
  const ptero = pteroQuery.data;

  function onPteroSave(e: FormEvent) {
    e.preventDefault();
    savePteroMutation.mutate();
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Instellingen</h1>
        <p className="page__desc">
          EscapezCore-modules en Pterodactyl-integratie. Module-toggles proxied
          via de backend naar Core — geen RCON of secrets in de browser.
        </p>
      </header>

      {coreOffline ? (
        <div
          className="settings-banner settings-banner--warn"
          role="status"
          title="Geen recente EscapezCore heartbeat ontvangen via de bridge"
        >
          EscapezCore lijkt offline (geen heartbeat). Toggles worden lokaal
          opgeslagen; sync blijft pending tot Core weer bereikbaar is.
        </div>
      ) : null}

      {coreOnline ? (
        <div className="settings-banner settings-banner--ok" role="status">
          EscapezCore heartbeat ontvangen. Module GET/PATCH gaat via backend{' '}
          <span className="mono">CORE_API_BASE</span> (default{' '}
          <span className="mono">http://127.0.0.1:8765</span>); zet{' '}
          <span className="mono">off</span> om alleen lokaal te bewaren.
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`settings-toast settings-toast--${feedback.kind}`}
          role="status"
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="page__card">
        <h2 className="settings-section-title settings-section-title-row">
          <span>EscapezCore-modules</span>
          <HelpTip label="Uitleg EscapezCore-modules" wide>
            <p>
              Aan/uit schakelt de module in EscapezCore (soft-reload). De backend
              proxyt naar Core; de browser stuurt geen geheimen.
            </p>
            <ul>
              <li>
                <strong>Gesynchroniseerd met Core</strong> — live status van Core.
              </li>
              <li>
                <strong>Lokaal / pending</strong> — opgeslagen in het panel; sync
                volgt wanneer Core bereikbaar is of CORE_API_BASE niet op off staat.
              </li>
            </ul>
          </HelpTip>
        </h2>
        <p className="settings-section-desc">
          Stabiele ids: scoreboard, tips, vote, resourcepack, reports,
          staffchat, items. Wijzigingen proxied naar EscapezCore met soft-reload;
          offline → lokaal + pending.
        </p>

        {modulesQuery.isPending ? (
          <p className="empty-state">Modules laden…</p>
        ) : null}

        {modulesQuery.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {modulesQuery.error instanceof ApiError
                ? modulesQuery.error.message
                : 'Kan modules niet laden.'}
            </p>
            <button
              type="button"
              className="planner__btn planner__btn--ghost"
              onClick={() => void modulesQuery.refetch()}
            >
              Opnieuw proberen
            </button>
          </div>
        ) : null}

        {modulesQuery.isSuccess && modules.length === 0 ? (
          <div className="empty-state">
            <p>Geen modules gevonden.</p>
          </div>
        ) : null}

        {modulesQuery.isSuccess && modules.length > 0 ? (
          <ul className="module-list">
            {modules.map((mod) => {
              const busy =
                toggleMutation.isPending &&
                toggleMutation.variables?.id === mod.id;
              const desc = MODULE_DESCRIPTIONS[mod.id] ?? '';
              const disabledTitle = coreOffline
                ? 'EscapezCore offline — wijziging wordt lokaal opgeslagen, sync pending'
                : undefined;

              return (
                <li key={mod.id} className="module-row">
                  <div className="module-row__info">
                    <div className="module-row__title-line">
                      <strong className="module-row__label">{mod.label}</strong>
                      <span className="module-row__id mono">{mod.id}</span>
                    </div>
                    {desc ? (
                      <p className="module-row__desc">{desc}</p>
                    ) : null}
                    <span
                      className={sourceBadgeClass(mod.source)}
                      title={sourceLabel(mod.source)}
                    >
                      {sourceLabel(mod.source)}
                    </span>
                  </div>
                  <label
                    className={`module-switch${busy ? ' module-switch--busy' : ''}`}
                    title={disabledTitle}
                  >
                    <span className="visually-hidden">
                      {mod.label} {mod.enabled ? 'uit' : 'aan'} zetten
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={mod.enabled}
                      disabled={busy || toggleMutation.isPending}
                      aria-checked={mod.enabled}
                      onChange={(e) => {
                        toggleMutation.mutate({
                          id: mod.id,
                          enabled: e.target.checked,
                        });
                      }}
                    />
                    <span className="module-switch__track" aria-hidden>
                      <span className="module-switch__thumb" />
                    </span>
                    <span className="module-switch__text">
                      {mod.enabled ? 'Aan' : 'Uit'}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="page__card settings-ptero">
        <h2 className="settings-section-title settings-section-title-row">
          <span>Pterodactyl</span>
          <HelpTip label="Uitleg Pterodactyl-instellingen" wide>
            <p>
              Keys maak je in het Pterodactyl-panel onder Account, API Credentials.
              Application-keys (vaak ptla) voor serverlijst; Client-keys (ptlc) voor
              power en resources.
            </p>
            <p>
              Keys gaan alleen naar de Nest-backend en worden nooit teruggelezen in
              de browser (write-only). Geen geheimen in localStorage.
            </p>
            <p>
              <strong>Test verbinding</strong> laat de backend de Application API
              aanroepen; de UI toont alleen ok of fout — geen key-waarden.
            </p>
          </HelpTip>
        </h2>
        <p className="settings-section-desc">
          Application API voor serverlijst. API-keys zijn write-only: bij
          opslaan stuur je een nieuwe key, de API geeft nooit plaintext terug
          (alleen <code>configured</code> / gemaskeerde hint). Credentials
          blijven op de backend (<code>data/ptero.json</code> of env).
        </p>

        {pteroQuery.isPending ? (
          <p className="empty-state">Pterodactyl-config laden…</p>
        ) : null}

        {pteroQuery.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {pteroQuery.error instanceof ApiError
                ? pteroQuery.error.message
                : 'Kan Pterodactyl-instellingen niet laden.'}
            </p>
          </div>
        ) : null}

        {ptero ? (
          <dl className="dash-dl settings-ptero__status">
            <div>
              <dt>Status</dt>
              <dd>
                <span
                  className={
                    ptero.configured
                      ? 'server-badge server-badge--yes'
                      : 'server-badge server-badge--no'
                  }
                >
                  {ptero.configured ? 'Geconfigureerd' : 'Niet geconfigureerd'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Host</dt>
              <dd>{ptero.baseUrlHost ?? '—'}</dd>
            </div>
            <div>
              <dt>Application API-key</dt>
              <dd>
                {ptero.apiKeyConfigured
                  ? ptero.apiKeyHint ?? '••••'
                  : 'Niet gezet'}
              </dd>
            </div>
            <div>
              <dt>Client API-key</dt>
              <dd>
                {ptero.clientApiKeyConfigured
                  ? ptero.clientApiKeyHint ?? '••••'
                  : 'Optioneel — niet gezet'}
              </dd>
            </div>
            <div>
              <dt>Bron</dt>
              <dd>{ptero.source}</dd>
            </div>
          </dl>
        ) : null}

        <form className="settings-ptero__form" onSubmit={onPteroSave}>
          <LabelWithHelp
            htmlFor="ptero-url"
            text="Panel-URL"
            helpLabel="Uitleg Panel-URL"
            help={
              <p>
                Basis-URL van je Pterodactyl-panel, bv. https://panel.example.com
                (zonder pad). Geen API-sleutel in deze URL.
              </p>
            }
          />
          <input
            id="ptero-url"
            className="server-input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://panel.example.com"
            autoComplete="off"
          />

          <LabelWithHelp
            htmlFor="ptero-key"
            text="Application API-key (write-only)"
            helpLabel="Uitleg Application API-key"
            help={
              <p>
                Application API-sleutel uit Pterodactyl. Nodig voor serverlijst.
                Leeg laten bij opslaan behoudt de bestaande sleutel op de backend.
              </p>
            }
          />
          <input
            id="ptero-key"
            className="server-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              ptero?.apiKeyConfigured
                ? 'Nieuwe key om te vervangen (leeg = behouden)'
                : 'ptla_…'
            }
            autoComplete="new-password"
          />

          <LabelWithHelp
            htmlFor="ptero-client-key"
            text="Client API-key (optioneel, power/resources)"
            helpLabel="Uitleg Client API-key"
            help={
              <p>
                Client API-sleutel voor power-acties en resources. Optioneel;
                zonder Client-sleutel blijven power/status stubs of beperkt.
              </p>
            }
          />
          <input
            id="ptero-client-key"
            className="server-input"
            type="password"
            value={clientApiKey}
            onChange={(e) => setClientApiKey(e.target.value)}
            placeholder={
              ptero?.clientApiKeyConfigured
                ? 'Nieuwe key om te vervangen (leeg = behouden)'
                : 'ptlc_…'
            }
            autoComplete="new-password"
          />

          <LabelWithHelp
            htmlFor="ptero-server"
            text="Default server identifier (optioneel)"
            helpLabel="Uitleg default server"
            help={
              <p>
                Korte identifier van de standaard gameserver in Pterodactyl
                (geen wachtwoord). Gebruikt als default voor status/power.
              </p>
            }
          />
          <input
            id="ptero-server"
            className="server-input"
            value={defaultServerId}
            onChange={(e) => setDefaultServerId(e.target.value)}
            placeholder={
              ptero?.defaultServerIdHint
                ? `Huidig: ${ptero.defaultServerIdHint} — vul in om te wijzigen`
                : 'abcd1234'
            }
            autoComplete="off"
          />

          <div className="settings-ptero__actions">
            <button
              type="submit"
              className="server-btn server-btn--primary"
              disabled={savePteroMutation.isPending}
            >
              {savePteroMutation.isPending ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button
              type="button"
              className="server-btn server-btn--start"
              disabled={testPteroMutation.isPending || !ptero?.configured}
              onClick={() => testPteroMutation.mutate()}
            >
              {testPteroMutation.isPending
                ? 'Testen…'
                : 'Verbinding testen'}
            </button>
            <HelpTip label="Uitleg verbinding testen">
              <p>
                Roept vanaf de backend de Pterodactyl Application API aan.
                Sleutels blijven op de server; de browser ziet alleen of de test slaagde.
              </p>
            </HelpTip>
          </div>
        </form>
      </div>
    </section>
  );
}

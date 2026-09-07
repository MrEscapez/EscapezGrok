import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  fetchBridgeStatus,
  fetchSettingsModules,
  patchSettingsModule,
  type ModulePatchResponse,
  type ModuleSource,
  type ModuleStatus,
} from '../lib/api';

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
            ? 'Lokaal opgeslagen — sync met EscapezCore pending (FASE 10 stub).'
            : 'Lokaal opgeslagen.';

      setFeedback({
        kind: data.syncStatus === 'synced' ? 'ok' : 'warn',
        message: `${data.label}: ${data.enabled ? 'aan' : 'uit'}. Soft-reload: ${data.note}. ${syncHint}`,
      });
    },
  });

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 8000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const modules = modulesQuery.data?.modules ?? [];

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Instellingen</h1>
        <p className="page__desc">
          EscapezCore-modules aan/uit. Soft-reload contract klaar voor FASE 10
          — geen RCON of secrets in de browser.
        </p>
      </header>

      {coreOffline ? (
        <div
          className="settings-banner settings-banner--warn"
          role="status"
          title="Geen recente EscapezCore heartbeat ontvangen via de bridge"
        >
          EscapezCore lijkt offline (geen heartbeat). Toggles worden lokaal
          opgeslagen; sync blijft pending tot de bridge live is.
        </div>
      ) : null}

      {coreOnline ? (
        <div className="settings-banner settings-banner--ok" role="status">
          EscapezCore heartbeat ontvangen. Module-push naar Core gebeurt als{' '}
          <span className="mono">CORE_API_BASE</span> op de backend staat;
          anders blijft sync pending.
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
        <h2 className="settings-section-title">Modules</h2>
        <p className="settings-section-desc">
          Stabiele ids: scoreboard, tips, vote, resourcepack, reports,
          staffchat, items. Wijzigingen vragen een soft-reload (stub tot
          EscapezCore FASE 10).
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
    </section>
  );
}

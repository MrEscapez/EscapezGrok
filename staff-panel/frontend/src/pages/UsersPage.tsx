import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  createStaffUser,
  fetchRoles,
  fetchStaffUsers,
  updateRolePermissions,
  updateStaffUser,
  type StaffRole,
  type StaffUserListItem,
} from '../lib/api';
import { useCan } from '../hooks/useMeQuery';
import { HelpTip } from '../components/HelpTip';

type Feedback = { kind: 'ok' | 'error'; message: string };

export function UsersPage() {
  const queryClient = useQueryClient();
  const can = useCan();
  const canManage = can('users:manage');

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleIds, setNewRoleIds] = useState<string[]>(['helper']);
  const [editRoles, setEditRoles] = useState<Record<string, string[]>>({});
  const [resetPassword, setResetPassword] = useState<Record<string, string>>(
    {},
  );
  const [matrixRoleId, setMatrixRoleId] = useState('moderator');
  const [matrixPerms, setMatrixPerms] = useState<string[]>([]);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: fetchStaffUsers,
    retry: false,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    retry: false,
  });

  const roles = rolesQuery.data?.items ?? [];
  const catalog = rolesQuery.data?.catalog ?? [];

  useEffect(() => {
    if (!usersQuery.data) return;
    const next: Record<string, string[]> = {};
    for (const u of usersQuery.data.items) {
      next[u.id] = [...u.roleIds];
    }
    setEditRoles(next);
  }, [usersQuery.data]);

  useEffect(() => {
    const role = roles.find((r) => r.id === matrixRoleId);
    if (role) setMatrixPerms([...role.permissions]);
  }, [roles, matrixRoleId]);

  const createMutation = useMutation({
    mutationFn: () =>
      createStaffUser({
        username: newUsername.trim(),
        password: newPassword,
        roleIds: newRoleIds,
      }),
    onSuccess: () => {
      setFeedback({ kind: 'ok', message: 'Gebruiker aangemaakt.' });
      setNewUsername('');
      setNewPassword('');
      setNewRoleIds(['helper']);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError ? err.message : 'Aanmaken mislukt',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string;
      roleIds: string[];
      password?: string;
    }) =>
      updateStaffUser(input.id, {
        roleIds: input.roleIds,
        password: input.password,
      }),
    onSuccess: (_data, vars) => {
      setFeedback({ kind: 'ok', message: 'Gebruiker bijgewerkt.' });
      setResetPassword((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (err: unknown) => {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError ? err.message : 'Bijwerken mislukt',
      });
    },
  });

  const roleMutation = useMutation({
    mutationFn: () => updateRolePermissions(matrixRoleId, matrixPerms),
    onSuccess: () => {
      setFeedback({ kind: 'ok', message: 'Rolpermissies opgeslagen.' });
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (err: unknown) => {
      setFeedback({
        kind: 'error',
        message:
          err instanceof ApiError ? err.message : 'Opslaan mislukt',
      });
    },
  });

  const selectedRole: StaffRole | undefined = useMemo(
    () => roles.find((r) => r.id === matrixRoleId),
    [roles, matrixRoleId],
  );

  function toggleNewRole(roleId: string) {
    setNewRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  }

  function toggleEditRole(userId: string, roleId: string) {
    setEditRoles((prev) => {
      const current = prev[userId] ?? [];
      const next = current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId];
      return { ...prev, [userId]: next };
    });
  }

  function toggleMatrixPerm(perm: string) {
    if (matrixRoleId === 'admin') return;
    setMatrixPerms((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm],
    );
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    createMutation.mutate();
  }

  const users: StaffUserListItem[] = usersQuery.data?.items ?? [];

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title page__title-row">
          <span>Gebruikers &amp; rollen</span>
          <HelpTip label="Uitleg gebruikers en RBAC" wide>
            <p>
              Rollen bundelen permissies (admin / moderator / helper). Effectieve
              rechten = unie van toegewezen rollen. De UI verbergt knoppen; de
              API weigert met 403 zonder permissie.
            </p>
            <p>
              <code>users:manage</code> nodig om accounts/rollen te wijzigen.
              Admin-rol houdt altijd de volledige catalogus.
            </p>
          </HelpTip>
        </h1>
        <p className="page__desc">
          Staff-accounts, roltoewijzing en permissiematrix. Handhaving gebeurt
          altijd op de backend (403 zonder rechten).
        </p>
      </header>

      {feedback ? (
        <div
          className={`settings-toast settings-toast--${
            feedback.kind === 'ok' ? 'ok' : 'error'
          }`}
          role="status"
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="page__card">
        <h2 className="settings-section-title settings-section-title-row">
          <span>Staff-gebruikers</span>
          <HelpTip label="Uitleg staff-gebruikers">
            <p>
              Accounts met bcrypt-wachtwoord en een of meer rollen. Zonder
              <code>users:manage</code> alleen bekijken.
            </p>
          </HelpTip>
        </h2>
        {usersQuery.isPending ? (
          <p className="empty-state">Laden…</p>
        ) : usersQuery.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {usersQuery.error instanceof ApiError
                ? usersQuery.error.message
                : 'Kon gebruikers niet laden'}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gebruiker</th>
                  <th>Rollen</th>
                  <th>Permissies</th>
                  {canManage ? <th>Acties</th> : null}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.username}</strong>
                      <div className="mono">{u.id.slice(0, 14)}…</div>
                    </td>
                    <td>
                      {canManage ? (
                        <div className="chip-row">
                          {roles.map((r) => (
                            <label key={r.id} className="chip-check">
                              <input
                                type="checkbox"
                                checked={(editRoles[u.id] ?? []).includes(
                                  r.id,
                                )}
                                onChange={() => toggleEditRole(u.id, r.id)}
                              />
                              {r.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        u.roles.map((r) => r.name).join(', ') || '—'
                      )}
                    </td>
                    <td>
                      <span className="badge">{u.permissions.length}</span>
                    </td>
                    {canManage ? (
                      <td>
                        <div className="action-stack">
                          <input
                            type="password"
                            className="server-input input--sm"
                            placeholder="Nieuw wachtwoord (optioneel)"
                            value={resetPassword[u.id] ?? ''}
                            onChange={(e) =>
                              setResetPassword((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="server-btn server-btn--primary btn--sm"
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({
                                id: u.id,
                                roleIds: editRoles[u.id] ?? u.roleIds,
                                password: resetPassword[u.id]?.trim()
                                  ? resetPassword[u.id]
                                  : undefined,
                              })
                            }
                          >
                            Opslaan
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage ? (
        <div className="page__card">
          <h2 className="settings-section-title">Nieuwe gebruiker</h2>
          <p className="settings-section-desc">
            Stub-formulier — wachtwoord wordt met bcrypt gehashed op de
            backend. Geen secrets in de frontend-bundle.
          </p>
          <form className="form-grid" onSubmit={onCreate}>
            <label className="login-field">
              <span>Gebruikersnaam</span>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                minLength={2}
                autoComplete="off"
              />
            </label>
            <label className="login-field">
              <span>Wachtwoord</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={4}
                autoComplete="new-password"
              />
            </label>
            <fieldset className="field">
              <legend>Rollen</legend>
              <div className="chip-row">
                {roles.map((r) => (
                  <label key={r.id} className="chip-check">
                    <input
                      type="checkbox"
                      checked={newRoleIds.includes(r.id)}
                      onChange={() => toggleNewRole(r.id)}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="server-btn server-btn--primary"
              disabled={createMutation.isPending || newRoleIds.length === 0}
            >
              {createMutation.isPending ? 'Bezig…' : 'Aanmaken'}
            </button>
          </form>
        </div>
      ) : null}

      <div className="page__card">
                <h2 className="settings-section-title settings-section-title-row">
                  <span>Rolpermissies</span>
                  <HelpTip label="Uitleg rolpermissies">
                    <p>
                      Vink permissies aan per rol. Wijzigingen gelden voor alle users met
                      die rol (sessies worden ververst). Helper heeft standaard geen
                      settings:manage.
                    </p>
                  </HelpTip>
                </h2>
        <p className="settings-section-desc">
          Admin heeft altijd alle permissies. Wijzigingen gelden direct voor
          actieve sessies.
        </p>
        <label className="login-field" style={{ maxWidth: 320 }}>
          <span>Rol</span>
          <select
            className="server-input"
            value={matrixRoleId}
            onChange={(e) => setMatrixRoleId(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        {rolesQuery.isPending ? (
          <p className="empty-state">Catalogus laden…</p>
        ) : (
          <div className="perm-matrix">
            {catalog.map((p) => {
              const checked = matrixPerms.includes(p.id);
              const locked = matrixRoleId === 'admin';
              return (
                <label key={p.id} className="perm-matrix__item">
                  <input
                    type="checkbox"
                    checked={locked ? true : checked}
                    disabled={!canManage || locked}
                    onChange={() => toggleMatrixPerm(p.id)}
                  />
                  <span>
                    <code>{p.id}</code>
                    <span className="module-row__desc"> — {p.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {canManage && selectedRole && matrixRoleId !== 'admin' ? (
          <button
            type="button"
            className="server-btn server-btn--primary"
            style={{ marginTop: '1rem' }}
            disabled={roleMutation.isPending}
            onClick={() => roleMutation.mutate()}
          >
            {roleMutation.isPending ? 'Opslaan…' : 'Permissies opslaan'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMeQuery } from '../hooks/useMeQuery';
import { logout } from '../lib/api';
import { can } from '../lib/permissions';

const NAV_ITEMS: { to: string; label: string; permission: string }[] = [
  { to: '/dashboard', label: 'Dashboard', permission: 'dashboard:view' },
  { to: '/players', label: 'Spelers', permission: 'players:view' },
  { to: '/reports', label: 'Reports', permission: 'reports:view' },
  { to: '/punishments', label: 'Straffen', permission: 'punishments:view' },
  { to: '/tickets', label: 'Tickets', permission: 'tickets:view' },
  { to: '/appeals', label: 'Appeals', permission: 'appeals:view' },
  { to: '/server', label: 'Servers', permission: 'server:view' },
  { to: '/staff-info', label: 'Staff Info', permission: 'staff_docs:read' },
  { to: '/audit', label: 'Audit', permission: 'audit:view' },
  { to: '/users', label: 'Gebruikers', permission: 'users:view' },
  { to: '/settings', label: 'Instellingen', permission: 'settings:view' },
];

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const meQuery = useMeQuery();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/login', { replace: true });
    },
  });

  const username = meQuery.data?.username ?? '…';
  const permissions = meQuery.data?.permissions;
  const visibleNav = NAV_ITEMS.filter((item) =>
    can(permissions, item.permission),
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo" aria-hidden>
            EC
          </span>
          <div className="topbar__brand-text">
            <strong className="topbar__title">EscapezCraft</strong>
            <span className="topbar__subtitle">Staff Panel</span>
          </div>
        </div>

        <nav className="topbar__nav" aria-label="Hoofdnavigatie">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `topbar__tab${isActive ? ' topbar__tab--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar__user">
          <span className="topbar__username" title="Ingelogde gebruiker">
            {username}
          </span>
          <button
            type="button"
            className="topbar__logout"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? 'Bezig…' : 'Uitloggen'}
          </button>
          <button
            type="button"
            className="topbar__menu"
            aria-label={menuOpen ? 'Sluit menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </header>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="topbar-backdrop"
            aria-label="Sluit menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="topbar__drawer" aria-label="Mobiel menu">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `topbar__drawer-link${isActive ? ' topbar__drawer-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </>
      ) : null}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

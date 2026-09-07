import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/players', label: 'Spelers' },
  { to: '/reports', label: 'Reports' },
  { to: '/punishments', label: 'Straffen' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/appeals', label: 'Appeals' },
  { to: '/planner', label: 'Planner' },
  { to: '/server', label: 'Server' },
  { to: '/audit', label: 'Audit' },
  { to: '/settings', label: 'Instellingen' },
];

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${drawerOpen ? 'sidebar--open' : ''}`}
        aria-label="Hoofdnavigatie"
      >
        <div className="sidebar__brand">
          <span className="sidebar__logo">EC</span>
          <div>
            <strong className="sidebar__title">EscapezCraft</strong>
            <span className="sidebar__subtitle">Staff Panel</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
              onClick={() => setDrawerOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Sluit menu"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <span className="topbar__hint">Dark neon · FASE 11–12 skeleton</span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

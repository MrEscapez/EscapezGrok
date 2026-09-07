import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { RequirePermission } from './components/RequirePermission';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlayersPage } from './pages/PlayersPage';
import { ReportsPage } from './pages/ReportsPage';
import { PunishmentsPage } from './pages/PunishmentsPage';
import { TicketsPage } from './pages/TicketsPage';
import { StubPage } from './pages/StubPage';
import { ServerPage } from './pages/ServerPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlannerPage } from './pages/PlannerPage';
import { UsersPage } from './pages/UsersPage';
import { ForbiddenPage } from './pages/ForbiddenPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="forbidden" element={<ForbiddenPage />} />

          <Route element={<RequirePermission permission="dashboard:view" />}>
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<RequirePermission permission="players:view" />}>
            <Route path="players" element={<PlayersPage />} />
          </Route>
          <Route element={<RequirePermission permission="reports:view" />}>
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route element={<RequirePermission permission="punishments:view" />}>
            <Route path="punishments" element={<PunishmentsPage />} />
          </Route>
          <Route element={<RequirePermission permission="tickets:view" />}>
            <Route path="tickets" element={<TicketsPage />} />
          </Route>
          <Route element={<RequirePermission permission="appeals:view" />}>
            <Route
              path="appeals"
              element={
                <StubPage
                  title="Appeals"
                  description="Ban-/mute-appeals (placeholder)."
                />
              }
            />
          </Route>
          <Route element={<RequirePermission permission="planner:view" />}>
            <Route path="planner" element={<PlannerPage />} />
          </Route>
          <Route element={<RequirePermission permission="server:view" />}>
            <Route path="server" element={<ServerPage />} />
          </Route>
          <Route element={<RequirePermission permission="audit:view" />}>
            <Route
              path="audit"
              element={
                <StubPage
                  title="Audit"
                  description="Auditlog van staff-acties (placeholder)."
                />
              }
            />
          </Route>
          <Route element={<RequirePermission permission="users:view" />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route element={<RequirePermission permission="settings:view" />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
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

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="punishments" element={<PunishmentsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route
            path="appeals"
            element={
              <StubPage
                title="Appeals"
                description="Ban-/mute-appeals (placeholder)."
              />
            }
          />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="server" element={<ServerPage />} />
          <Route
            path="audit"
            element={
              <StubPage
                title="Audit"
                description="Auditlog van staff-acties (placeholder)."
              />
            }
          />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

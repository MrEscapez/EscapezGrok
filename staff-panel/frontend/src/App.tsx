import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlayersPage } from './pages/PlayersPage';
import { ReportsPage } from './pages/ReportsPage';
import { StubPage } from './pages/StubPage';

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
          <Route
            path="punishments"
            element={
              <StubPage
                title="Straffen"
                description="Bans, mutes en warnings (placeholder — geen LiteBans)."
              />
            }
          />
          <Route
            path="tickets"
            element={
              <StubPage
                title="Tickets"
                description="Supporttickets (placeholder)."
              />
            }
          />
          <Route
            path="appeals"
            element={
              <StubPage
                title="Appeals"
                description="Ban-/mute-appeals (placeholder)."
              />
            }
          />
          <Route
            path="planner"
            element={
              <StubPage
                title="Planner"
                description="Event- en shiftplanner (placeholder — geen engine)."
              />
            }
          />
          <Route
            path="server"
            element={
              <StubPage
                title="Server"
                description="Serverbeheer (placeholder — geen live RCON)."
              />
            }
          />
          <Route
            path="audit"
            element={
              <StubPage
                title="Audit"
                description="Auditlog van staff-acties (placeholder)."
              />
            }
          />
          <Route
            path="settings"
            element={
              <StubPage
                title="Instellingen"
                description="Panel- en teaminstellingen (placeholder)."
              />
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

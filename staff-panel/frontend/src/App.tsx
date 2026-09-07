import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { StubPage } from './pages/StubPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <StubPage
              title="Dashboard"
              description="Overzicht van staff-activiteit en serverstatus (placeholder)."
            />
          }
        />
        <Route
          path="players"
          element={
            <StubPage
              title="Spelers"
              description="Spelerzoeken en profielen (placeholder)."
            />
          }
        />
        <Route
          path="reports"
          element={
            <StubPage
              title="Reports"
              description="Inkomende reports van spelers (placeholder)."
            />
          }
        />
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
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

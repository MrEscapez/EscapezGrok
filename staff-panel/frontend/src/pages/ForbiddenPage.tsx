import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">403 — Geen toegang</h1>
        <p className="page__desc">
          Je hebt geen rechten voor deze pagina. Vraag een admin om de juiste rol
          of permissie toe te wijzen.
        </p>
      </header>
      <div className="page__card">
        <p className="settings-section-desc">
          De API weigert mutaties zonder de juiste permissie (HTTP 403), ook als
          je de URL handmatig opent.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link className="server-btn server-btn--primary" to="/dashboard">
            Terug naar dashboard
          </Link>
        </p>
      </div>
    </section>
  );
}

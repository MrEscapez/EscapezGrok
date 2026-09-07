type StubPageProps = {
  title: string;
  description?: string;
};

export function StubPage({ title, description }: StubPageProps) {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">{title}</h1>
        {description ? <p className="page__desc">{description}</p> : null}
      </header>
      <div className="page__card">
        <p>
          Dit is een skeleton-pagina (FASE 11–12). Functionaliteit volgt in
          latere fases.
        </p>
      </div>
    </section>
  );
}

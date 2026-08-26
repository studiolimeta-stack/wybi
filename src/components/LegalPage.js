/**
 * Shared shell for the legal pages (privacy, terms, cookies). Pulled out
 * rather than repeated three times so the heading/date treatment can only
 * drift once, not three ways.
 */
export function LegalPage({ title, updated, children }) {
  return (
    <main className="wrap inner-page pb-16">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="hint mt-2">Last updated {updated}.</p>
        <div className="legal-content mt-8 space-y-4 text-sm leading-relaxed text-muted">{children}</div>
      </div>
    </main>
  );
}

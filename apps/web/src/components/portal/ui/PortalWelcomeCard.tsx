type PortalWelcomeCardProps = {
  role: "aluno" | "professor";
  name?: string | null;
  context?: string | null;
  date: Date;
  loading?: boolean;
};

const dayFormatter = new Intl.DateTimeFormat("pt-AO", {
  timeZone: "Africa/Luanda", weekday: "long", day: "numeric", month: "long",
});

/** Shared decorative signature; clipped by the institutional card, never interactive. */
export function PortalCulturalSignature() {
  return <div className="klasse-welcome-signature" data-testid="portal-cultural-signature" aria-hidden="true" />;
}

/** Institutional identity only: no fetches, effects, interactive content or tenant state. */
export function PortalWelcomeCard({ role, name, context, date, loading = false }: PortalWelcomeCardProps) {
  const displayName = name?.trim() || (role === "aluno" ? "aluno" : "Professor");
  const day = dayFormatter.format(date);
  return (
    <header aria-busy={loading} data-testid="portal-welcome-card" className="klasse-welcome-card min-w-0 overflow-hidden rounded-xl">
      <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-xs font-medium leading-5 tracking-wide">Portal do {role}</p>
        <div className="klasse-welcome-editorial min-w-0 space-y-1.5 pl-3.5">
          <h1 className="break-words text-[26px] font-semibold leading-[1.2] tracking-[-0.035em] sm:text-3xl">
            {loading ? "A carregar…" : `Olá, ${displayName}`}
          </h1>
          {!loading && context?.trim() && <p className="break-words text-sm font-medium leading-relaxed">{context}</p>}
        </div>
        <time suppressHydrationWarning className="block text-xs font-medium leading-5">{day}</time>
      </div>
      <PortalCulturalSignature />
    </header>
  );
}

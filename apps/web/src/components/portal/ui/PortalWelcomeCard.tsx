import styles from "./PortalWelcomeCard.module.css";

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
const shortFormatter = new Intl.DateTimeFormat("pt-AO", {
  timeZone: "Africa/Luanda", day: "2-digit", month: "short",
});

/** Institutional identity only: no fetches, effects, interactive content or tenant state. */
export function PortalWelcomeCard({ role, name, context, date, loading = false }: PortalWelcomeCardProps) {
  const displayName = name?.trim() || (role === "aluno" ? "aluno" : "Professor");
  const day = dayFormatter.format(date);
  const shortDate = shortFormatter.format(date).replace(/\s+de\s+/g, " ").replace(/\./g, "");
  return (
    <header aria-busy={loading} data-testid="portal-welcome-card" className={`${styles.card} min-w-0 overflow-hidden rounded-xl`}>
      <div className="space-y-3 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide">Portal do {role}</p>
          <time aria-hidden="true" suppressHydrationWarning className="text-[11px] font-semibold uppercase tracking-wide">{shortDate}</time>
        </div>
        <div className={`${styles.editorial} min-w-0 space-y-1 pl-3`}>
          <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {loading ? "A carregar…" : `Olá, ${displayName}`}
          </h1>
          {!loading && context?.trim() && <p className="break-words text-sm font-medium leading-relaxed">{context}</p>}
        </div>
        <p suppressHydrationWarning className="text-xs leading-relaxed">{day}</p>
      </div>
      <div className={styles.signature} aria-hidden="true" />
    </header>
  );
}

import Link from "next/link";

type MenuItem = {
  label: string;
  href: string;
};

type ConfigSystemShellProps = {
  escolaId: string;
  title: string;
  subtitle: string;
  menuItems: MenuItem[];
  children: React.ReactNode;
  prevHref?: string;
  nextHref?: string;
  testHref?: string;
  embedded?: boolean;
  showInternalMenu?: boolean;
  backHref?: string;
  impact?: {
    alunos?: number;
    turmas?: number;
    professores?: number;
    cursos?: number;
    classes?: number;
    disciplinas?: number;
  };
  statusItems?: string[];
  onSave?: () => void;
  saveDisabled?: boolean;
  customSaveLabel?: string; // Added customSaveLabel prop
};

export default function ConfigSystemShell({
  title,
  subtitle,
  children,
  menuItems,
  prevHref,
  nextHref,
  testHref,
  embedded = false,
  showInternalMenu = true,
  backHref,
  impact,
  statusItems,
  onSave,
  saveDisabled,
  customSaveLabel, // Added customSaveLabel to destructuring
}: ConfigSystemShellProps) {
  const status = statusItems ?? [];
  const impactSummary = [
    impact?.alunos !== undefined ? `${impact.alunos} alunos impactados` : null,
    impact?.turmas !== undefined ? `${impact.turmas} turmas afetadas` : null,
    impact?.professores !== undefined ? `${impact.professores} professores envolvidos` : null,
  ].filter(Boolean) as string[];
  const hasStatusData = status.length > 0 || impactSummary.length > 0;
  const hasActionControls = Boolean(onSave || testHref);
  const showRightPanel = hasStatusData || hasActionControls;
  return (
    <div className={embedded ? "w-full h-full space-y-6" : "max-w-6xl mx-auto px-6 py-8 space-y-6"}>
      <header className="flex flex-col gap-2">
        {!embedded && backHref && (
          <Link
            href={backHref}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground/80"
          >
            Voltar ao painel
          </Link>
        )}
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-foreground/80">{subtitle}</p>
      </header>

      {embedded ? (
        <main className="rounded-xl border border-border bg-card p-6 space-y-4 w-full h-full">
          {children}
          <div className="flex flex-wrap gap-3">
            {prevHref && (
              <Link
                href={prevHref}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {nextHref && (
              <Link
                href={nextHref}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Próximo
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {onSave && (
              <button
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                onClick={onSave}
                disabled={saveDisabled}
              >
                {customSaveLabel || "Salvar"}
              </button>
            )}
            {testHref && (
              <Link
                href={testHref}
                className="rounded-lg bg-amber px-3 py-2 text-center text-xs font-semibold text-white"
              >
                Testar
              </Link>
            )}
          </div>
        </main>
      ) : (
        <div
          className={
            showInternalMenu
              ? showRightPanel
                ? "grid grid-cols-1 lg:grid-cols-[220px_1fr_240px] gap-6"
                : "grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6"
              : showRightPanel
                ? "grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6"
                : "grid grid-cols-1 gap-6"
          }
        >
          {showInternalMenu ? (
            <aside className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:text-foreground hover:border-border"
                >
                  {item.label}
                </Link>
              ))}
            </aside>
          ) : null}

          <main className="rounded-xl border border-border bg-card p-6 space-y-4">
            {children}
            <div className="flex flex-wrap gap-3">
              {prevHref && (
                <Link
                  href={prevHref}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Anterior
                </Link>
              )}
              {nextHref && (
                <Link
                  href={nextHref}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Próximo
                </Link>
              )}
            </div>
          </main>

          {showRightPanel ? (
            <aside className="rounded-xl border border-border bg-card p-4 space-y-4">
              {hasStatusData ? (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Barra de status</h3>
                  <p className="text-xs text-muted-foreground">Impacto estimado das mudanças.</p>
                </div>
              ) : null}
              {status.length > 0 && (
                <ul className="text-xs text-foreground/80 space-y-2">
                  {status.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
              {impactSummary.length > 0 && (
                <ul className="text-xs text-foreground/80 space-y-2">
                  {impactSummary.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
              {hasActionControls ? (
                <div className="flex flex-col gap-2">
                  {onSave && (
                    <button
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                      onClick={onSave}
                      disabled={saveDisabled}
                    >
                      {customSaveLabel || "Salvar"}
                    </button>
                  )}
                  {testHref && (
                    <Link
                      href={testHref}
                      className="rounded-lg bg-amber px-3 py-2 text-center text-xs font-semibold text-white"
                    >
                      Testar
                    </Link>
                  )}
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}

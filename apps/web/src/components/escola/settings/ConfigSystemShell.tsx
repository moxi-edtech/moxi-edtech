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
  return (
    <div className={embedded ? "w-full h-full space-y-6" : "max-w-6xl mx-auto p-6 space-y-6"}>
      <header className="flex flex-col gap-2">
        {!embedded && backHref && (
          <Link
            href={backHref}
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
          >
            Voltar ao painel
          </Link>
        )}
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </header>

      {embedded ? (
        <main className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 w-full h-full">
          {children}
          <div className="flex flex-wrap gap-3">
            {prevHref && (
              <Link
                href={prevHref}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={onSave}
              disabled={saveDisabled || !onSave}
            >
              {customSaveLabel || "Salvar"}
            </button>
            {testHref && (
              <Link
                href={testHref}
                className="rounded-lg bg-klasse-gold px-3 py-2 text-center text-xs font-semibold text-white"
              >
                Testar
              </Link>
            )}
          </div>
        </main>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_240px] gap-6">
          <aside className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:border-slate-200"
              >
                {item.label}
              </Link>
            ))}
          </aside>

          <main className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            {children}
            <div className="flex flex-wrap gap-3">
              {prevHref && (
                <Link
                  href={prevHref}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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

          <aside className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Barra de status</h3>
              <p className="text-xs text-slate-500">Impacto estimado das mudanças.</p>
            </div>
            {status.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-2">
                {status.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
            {impactSummary.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-2">
                {impactSummary.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
            {impactSummary.length === 0 && status.length === 0 && (
              <p className="text-xs text-slate-500">Sem impacto calculado.</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={onSave}
                disabled={saveDisabled || !onSave}
              >
                {customSaveLabel || "Salvar"}
              </button>
              {testHref && (
                <Link
                  href={testHref}
                  className="rounded-lg bg-klasse-gold px-3 py-2 text-center text-xs font-semibold text-white"
                >
                  Testar
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

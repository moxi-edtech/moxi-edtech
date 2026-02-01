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
};

export default function ConfigSystemShell({
  title,
  subtitle,
  menuItems,
  children,
  prevHref,
  nextHref,
  testHref,
}: ConfigSystemShellProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </header>

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
          <ul className="text-xs text-slate-600 space-y-2">
            <li>450 alunos impactados</li>
            <li>18 turmas afetadas</li>
            <li>45 professores envolvidos</li>
          </ul>
          <div className="flex flex-col gap-2">
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Salvar
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
    </div>
  );
}

import Link from "next/link";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CalendarioConfiguracoesPage({ params }: PageProps) {
  const { id } = await params;
  const base = `/escola/${id}/admin/configuracoes`;
  const menuItems = [
    { label: "📅 Calendário", href: `${base}/calendario` },
    { label: "📊 Avaliação", href: `${base}/avaliacao` },
    { label: "👥 Turmas", href: `${base}/turmas` },
    { label: "💰 Financeiro", href: `${base}/financeiro` },
    { label: "🔄 Fluxos", href: `${base}/fluxos` },
    { label: "⚙️ Avançado", href: `${base}/avancado` },
  ];

  return (
    <ConfigSystemShell
      escolaId={id}
      title="Calendário Acadêmico · Períodos Letivos"
      subtitle="Defina os blocos de tempo do ano. A soma dos pesos deve ser 100%."
      menuItems={menuItems}
      prevHref={`${base}/sistema`}
      nextHref={`${base}/avaliacao`}
      testHref={`${base}/sandbox`}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Como deseja estruturar o ano?</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {"Trimestres"}, {"Semestres"}, {"Bimestres"}, {"Personalizar"}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Sua estrutura personalizada</p>
          <div className="mt-3 text-xs text-slate-600 space-y-2">
            <div>I Trimestre · 05-Fev → 15-Abr · Peso 30% · Trava 20-Abr</div>
            <div>II Trimestre · 22-Abr → 15-Jul · Peso 30% · Trava 20-Jul</div>
            <div>III Trimestre · 22-Jul → 30-Out · Peso 40% · Trava 05-Nov</div>
          </div>
          <div className="mt-3 text-xs text-emerald-600">Soma dos pesos: 100%</div>
        </div>
        <Link
          href={`/escola/${id}/admin/configuracoes/academico-completo`}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Abrir configuração real
        </Link>
      </div>
    </ConfigSystemShell>
  );
}

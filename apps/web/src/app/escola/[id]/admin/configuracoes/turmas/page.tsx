import Link from "next/link";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TurmasConfiguracoesPage({ params }: PageProps) {
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
      title="Turmas · Geração e Validação"
      subtitle="As turmas devem nascer do currículo publicado."
      menuItems={menuItems}
      prevHref={`${base}/avaliacao`}
      nextHref={`${base}/financeiro`}
      testHref={`${base}/sandbox`}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          Gere turmas automaticamente a partir do currículo publicado e valide disciplinas por turma.
        </div>
        <Link
          href={`/escola/${id}/admin/turmas`}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Abrir painel real de turmas
        </Link>
      </div>
    </ConfigSystemShell>
  );
}

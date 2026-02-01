import Link from "next/link";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AvaliacaoConfiguracoesPage({ params }: PageProps) {
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
      title="Sistema de Avaliação · Criar Novo Modelo"
      subtitle="Defina a fórmula e visualize a pauta do professor."
      menuItems={menuItems}
      prevHref={`${base}/calendario`}
      nextHref={`${base}/turmas`}
      testHref={`${base}/sandbox`}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Fórmula atual</p>
          <p className="text-sm text-slate-600 mt-2">(MAC * 0.4) + (NPP * 0.3) + (PT * 0.3)</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Componentes disponíveis</p>
          <ul className="mt-2 text-xs text-slate-600 space-y-1">
            <li>📝 MAC — Avaliação Contínua</li>
            <li>🧪 NPP — Prova do Professor</li>
            <li>📊 PT — Prova Trimestral</li>
          </ul>
        </div>
        <Link
          href={`/escola/${id}/admin/configuracoes/avaliacao-frequencia`}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Abrir configuração real
        </Link>
      </div>
    </ConfigSystemShell>
  );
}

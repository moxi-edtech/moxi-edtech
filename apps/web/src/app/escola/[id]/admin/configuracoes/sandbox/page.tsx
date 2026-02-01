import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SandboxConfiguracoesPage({ params }: PageProps) {
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
      title="Sandbox · Testar Configurações"
      subtitle="Simule o impacto sem tocar dados reais."
      menuItems={menuItems}
      prevHref={`${base}/avancado`}
      nextHref={`${base}/sistema`}
      testHref={`${base}/sandbox`}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          Turmas fictícias, notas simuladas e relatórios de conflitos antes de publicar.
        </div>
        <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-600">
          Relatório: 2 conflitos de horário · Fórmula OK · 1 etapa excede prazo.
        </div>
      </div>
    </ConfigSystemShell>
  );
}

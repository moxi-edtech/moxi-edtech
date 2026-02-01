import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SistemaConfiguracoesPage({ params }: PageProps) {
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
      title="Configurações do Sistema"
      subtitle="Ano Letivo 2025 · Controle completo para a Dona Maria."
      menuItems={menuItems}
      nextHref={`${base}/calendario`}
      testHref={`${base}/sandbox`}
    >
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Painel geral</h2>
        <p className="text-sm text-slate-600">
          Use o menu lateral para configurar cada etapa. O impacto aparece na barra direita antes de salvar.
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Checklist rápido: calendário, avaliação, currículo, turmas e fluxos.
        </div>
      </div>
    </ConfigSystemShell>
  );
}

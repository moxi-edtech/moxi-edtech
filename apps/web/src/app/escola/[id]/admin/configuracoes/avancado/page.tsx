import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AvancadoConfiguracoesPage({ params }: PageProps) {
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
      title="Avançado · Governança e Auditoria"
      subtitle="Ajustes críticos e políticas de segurança."
      menuItems={menuItems}
      prevHref={`${base}/fluxos`}
      nextHref={`${base}/sandbox`}
      testHref={`${base}/sandbox`}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          Logs imutáveis, permissões e políticas RLS são configuradas aqui.
        </div>
      </div>
    </ConfigSystemShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

export default function SandboxConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const menuItems = [
    { label: "📅 Calendário", href: `${base}/calendario` },
    { label: "📊 Avaliação", href: `${base}/avaliacao` },
    { label: "👥 Turmas", href: `${base}/turmas` },
    { label: "💰 Financeiro", href: `${base}/financeiro` },
    { label: "🔄 Fluxos", href: `${base}/fluxos` },
    { label: "⚙️ Avançado", href: `${base}/avancado` },
  ];

  const [previewSummary, setPreviewSummary] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      const res = await fetch(`/api/escola/${escolaId}/admin/setup/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: {} }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setPreviewSummary(json.data?.validations?.map((v: any) => `${v.severity}: ${v.message}`) ?? []);
      }
    };
    load();
  }, [escolaId]);

  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { sandbox: true } }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Sandbox · Testar Configurações"
      subtitle="Simule o impacto sem tocar dados reais."
      menuItems={menuItems}
      prevHref={`${base}/avancado`}
      nextHref={`${base}/sistema`}
      testHref={`${base}/sandbox`}
      statusItems={previewSummary}
      onSave={handleSave}
      saveDisabled={saving}
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

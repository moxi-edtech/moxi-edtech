"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

export default function FluxosConfiguracaoPage() {
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
  const [auditStatus, setAuditStatus] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      const res = await fetch(`/api/escola/${escolaId}/admin/audit/recent`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setAuditStatus((json.data ?? []).map((item: any) => `${item.action ?? 'AÇÃO'} · ${item.created_at}`));
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
        body: JSON.stringify({ changes: { fluxos: true } }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Fluxos de Trabalho · Aprovação de Notas"
      subtitle="Defina os passos e responsáveis para liberar boletins."
      menuItems={menuItems}
      prevHref={`${base}/financeiro`}
      nextHref={`${base}/avancado`}
      testHref={`${base}/sandbox`}
      statusItems={auditStatus}
      onSave={handleSave}
      saveDisabled={saving}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          1. Professor lança notas → 2. Coordenador valida → 3. Conselho delibera → 4. Diretor aprova.
        </div>
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          Biblioteca de etapas: notificações, assinatura digital, formulários e espera por dias.
        </div>
      </div>
    </ConfigSystemShell>
  );
}

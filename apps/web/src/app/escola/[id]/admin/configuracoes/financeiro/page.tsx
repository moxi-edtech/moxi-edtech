"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

export default function FinanceiroConfiguracoesPage() {
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

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { financeiro: true } }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Financeiro · Configurações"
      subtitle="Defina preços, multas e contas com segurança."
      menuItems={menuItems}
      prevHref={`${base}/turmas`}
      nextHref={`${base}/fluxos`}
      testHref={`${base}/sandbox`}
      onSave={handleSave}
      saveDisabled={saving}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          Configure valores oficiais e regras financeiras que impactam o ano letivo.
        </div>
        <Link
          href={escolaId ? `/escola/${escolaId}/financeiro/configuracoes/precos` : "#"}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Abrir financeiro real
        </Link>
      </div>
    </ConfigSystemShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type SetupState = {
  stage: string;
  next_action?: { label: string; href: string };
  blockers?: Array<{ title: string; detail: string; severity: string }>;
  badges?: Record<string, boolean>;
};

type ImpactData = {
  counts?: {
    alunos_afetados?: number;
    turmas_afetadas?: number;
    professores_afetados?: number;
  };
};

export default function SistemaConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const menuItems = useMemo(
    () =>
      escolaId
        ? [
            { label: "📅 Calendário", href: `${base}/calendario` },
            { label: "📊 Avaliação", href: `${base}/avaliacao` },
            { label: "👥 Turmas", href: `${base}/turmas` },
            { label: "💰 Financeiro", href: `${base}/financeiro` },
            { label: "🔄 Fluxos", href: `${base}/fluxos` },
            { label: "⚙️ Avançado", href: `${base}/avancado` },
          ]
        : [],
    [base, escolaId]
  );

  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      const stateRes = await fetch(`/api/escola/${escolaId}/admin/setup/state`, { cache: "no-store" });
      const stateJson = await stateRes.json().catch(() => null);
      if (stateRes.ok && stateJson?.ok) setSetupState(stateJson.data);

      const impactRes = await fetch(`/api/escola/${escolaId}/admin/setup/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const impactJson = await impactRes.json().catch(() => null);
      if (impactRes.ok && impactJson?.ok) setImpact(impactJson.data);
    };
    load();
  }, [escolaId]);

  const statusItems = setupState?.blockers?.map((b) => `${b.severity}: ${b.title}`) ?? [];

  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { sistema: true } }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Configurações do Sistema"
      subtitle="Ano Letivo 2025 · Controle completo para a Dona Maria."
      menuItems={menuItems}
      nextHref={`${base}/calendario`}
      testHref={`${base}/sandbox`}
      statusItems={statusItems}
      impact={{
        alunos: impact?.counts?.alunos_afetados,
        turmas: impact?.counts?.turmas_afetadas,
        professores: impact?.counts?.professores_afetados,
      }}
      onSave={handleSave}
      saveDisabled={saving}
    >
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Painel geral</h2>
        <p className="text-sm text-slate-600">
          Use o menu lateral para configurar cada etapa. O impacto aparece na barra direita antes de salvar.
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {setupState?.next_action
            ? `Próximo passo: ${setupState.next_action.label}`
            : "Checklist rápido: calendário, avaliação, currículo, turmas e fluxos."}
        </div>
      </div>
    </ConfigSystemShell>
  );
}

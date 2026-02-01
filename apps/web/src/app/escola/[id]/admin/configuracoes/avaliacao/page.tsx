"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type Modelo = {
  id: string;
  nome: string;
  componentes: { componentes?: Array<{ code: string; peso: number }> } | any;
  is_default?: boolean;
};

export default function AvaliacaoConfiguracoesPage() {
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

  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      const res = await fetch(`/api/escolas/${escolaId}/modelos-avaliacao`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setModelos(json.data ?? []);
    };
    load();
  }, [escolaId]);

  const modeloAtual = useMemo(
    () => modelos.find((m) => m.is_default) ?? modelos[0] ?? null,
    [modelos]
  );
  const formula = modeloAtual?.componentes?.componentes
    ? modeloAtual.componentes.componentes
        .map((c: any) => `${c.code} * ${c.peso / 100}`)
        .join(" + ")
    : "(MAC * 0.4) + (NPP * 0.3) + (PT * 0.3)";

  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { modelos: modelos.map((m) => m.id) } }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={id}
      title="Sistema de Avaliação · Criar Novo Modelo"
      subtitle="Defina a fórmula e visualize a pauta do professor."
      menuItems={menuItems}
      prevHref={`${base}/calendario`}
      nextHref={`${base}/turmas`}
      testHref={`${base}/sandbox`}
      onSave={handleSave}
      saveDisabled={saving}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Fórmula atual</p>
          <p className="text-sm text-slate-600 mt-2">{formula}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Componentes disponíveis</p>
          <ul className="mt-2 text-xs text-slate-600 space-y-1">
            {(modeloAtual?.componentes?.componentes ?? [
              { code: 'MAC', peso: 40 },
              { code: 'NPP', peso: 30 },
              { code: 'PT', peso: 30 },
            ]).map((c: any) => (
              <li key={c.code}>{c.code} — Peso {c.peso}%</li>
            ))}
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

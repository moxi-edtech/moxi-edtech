"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

type Periodo = {
  id: string;
  ano_letivo_id: string;
  tipo: string;
  numero: number;
  data_inicio: string;
  data_fim: string;
  trava_notas_em?: string | null;
  peso?: number | null;
};

export default function CalendarioConfiguracoesPage() {
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

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [anoLetivo, setAnoLetivo] = useState<{ id: string; ano: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      const res = await fetch(`/api/escola/${escolaId}/admin/periodos-letivos`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setPeriodos(json.periodos ?? []);
        setAnoLetivo(json.ano_letivo ?? null);
      }
    };
    load();
  }, [escolaId]);

  const pesoTotal = useMemo(
    () => periodos.reduce((sum, p) => sum + (p.peso ?? 0), 0),
    [periodos]
  );

  const handleSave = async () => {
    if (!escolaId || !anoLetivo) return;
    setSaving(true);
    try {
      const payload = periodos.map((p) => ({
        id: p.id,
        ano_letivo_id: p.ano_letivo_id ?? anoLetivo.id,
        tipo: p.tipo,
        numero: p.numero,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        trava_notas_em: p.trava_notas_em ? new Date(p.trava_notas_em).toISOString() : null,
        peso: p.peso ?? null,
      }));
      const res = await fetch(`/api/escola/${escolaId}/admin/periodos-letivos/upsert-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao salvar períodos");
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { periodos: payload } }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={id}
      title="Calendário Acadêmico · Períodos Letivos"
      subtitle="Defina os blocos de tempo do ano. A soma dos pesos deve ser 100%."
      menuItems={menuItems}
      prevHref={`${base}/sistema`}
      nextHref={`${base}/avaliacao`}
      testHref={`${base}/sandbox`}
      statusItems={anoLetivo ? [`Ano letivo ativo: ${anoLetivo.ano}`] : ["Ano letivo ativo não encontrado"]}
      onSave={handleSave}
      saveDisabled={saving}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Como deseja estruturar o ano?</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {"Trimestres"}, {"Semestres"}, {"Bimestres"}, {"Personalizar"}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Sua estrutura personalizada</p>
          <div className="mt-3 text-xs text-slate-600 space-y-2">
            {periodos.length === 0 && <div>Nenhum período encontrado.</div>}
            {periodos.map((p) => (
              <div key={p.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_200px] gap-2 items-center">
                <div>
                  {p.numero}º {p.tipo} · {p.data_inicio} → {p.data_fim}
                </div>
                <input
                  className="rounded border border-slate-200 px-2 py-1"
                  value={p.peso ?? ""}
                  placeholder="Peso"
                  onChange={(e) =>
                    setPeriodos((prev) =>
                      prev.map((item) =>
                        item.id === p.id ? { ...item, peso: Number(e.target.value) || null } : item
                      )
                    )
                  }
                />
                <input
                  type="datetime-local"
                  className="rounded border border-slate-200 px-2 py-1"
                  value={p.trava_notas_em ? p.trava_notas_em.slice(0, 16) : ""}
                  onChange={(e) =>
                    setPeriodos((prev) =>
                      prev.map((item) =>
                        item.id === p.id ? { ...item, trava_notas_em: e.target.value } : item
                      )
                    )
                  }
                />
              </div>
            ))}
          </div>
          <div className={`mt-3 text-xs ${pesoTotal === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
            Soma dos pesos: {pesoTotal}%
          </div>
        </div>
        <Link
          href={`/escola/${id}/admin/configuracoes/academico-completo`}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Abrir configuração real
        </Link>
      </div>
    </ConfigSystemShell>
  );
}

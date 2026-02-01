"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { 
  Wallet, 
  CalendarClock, 
  Percent, 
  AlertTriangle, 
  Landmark, 
  Lock, 
  ExternalLink 
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";

// --- TYPES ---
type FinanceiroConfig = {
  dia_vencimento_padrao: number;
  multa_atraso_percent: number;
  juros_diarios_percent: number;
  bloquear_inadimplentes: boolean;
  moeda: string;
};

const DEFAULT_CONFIG: FinanceiroConfig = {
  dia_vencimento_padrao: 5,
  multa_atraso_percent: 10, // Comum em Angola
  juros_diarios_percent: 0.5,
  bloquear_inadimplentes: false,
  moeda: "AOA",
};

export default function FinanceiroConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  
  const menuItems = buildConfigMenuItems(base);

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FinanceiroConfig>(DEFAULT_CONFIG);

  // --- FETCH ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!escolaId) return;
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/financeiro`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 404) {
            setLoading(false);
            return;
          }
          throw new Error(json?.error || "Falha ao carregar financeiro");
        }

        if (json?.data) setConfig(json.data);
      } catch (error) {
        console.error("Erro ao carregar financeiro", error);
        // Mantém default silenciosamente ou avisa
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [escolaId]);

  // --- HANDLERS ---
  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    
    const promise = fetch(`/api/escola/${escolaId}/admin/configuracoes/financeiro`, {
      method: "POST", // Ou PUT/PATCH dependendo da sua API
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = json?.error || (res.status === 404
          ? "Endpoint financeiro indisponível."
          : "Falha ao salvar");
        throw new Error(detail);
      }
      
      // Commit do setup step
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { financeiro: true } }),
      });
    });

    toast.promise(promise, {
      loading: 'Aplicando regras financeiras...',
      success: 'Política financeira atualizada!',
      error: 'Erro ao salvar regras.'
    });

    try { await promise; } finally { setSaving(false); }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Financeiro · Políticas de Cobrança"
      subtitle="Defina as regras globais de pagamentos, multas e restrições."
      menuItems={menuItems}
      prevHref={`${base}/turmas`}
      nextHref={`${base}/fluxos`}
      testHref={`${base}/sandbox`}
      onSave={handleSave}
      saveDisabled={saving}
    >
      {loading ? (
         <div className="py-12 text-center text-sm text-slate-500">Carregando dados financeiros...</div>
      ) : (
        <div className="space-y-6">
          
          {/* CARD 1: REGRAS GERAIS */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Regras de Cobrança</h3>
                <p className="text-xs text-slate-500">Padrões aplicados a todas as mensalidades.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Dia de Vencimento */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                  Dia de Vencimento Padrão
                </label>
                <select
                  value={config.dia_vencimento_padrao}
                  onChange={(e) => setConfig({ ...config, dia_vencimento_padrao: Number(e.target.value) })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                >
                  {[1, 5, 10, 15, 20, 25, 30].map(d => (
                    <option key={d} value={d}>Dia {d}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Data limite padrão para evitar multas.
                </p>
              </div>

              {/* Multa Fixa */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                  Multa por Atraso (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.multa_atraso_percent}
                    onChange={(e) => setConfig({ ...config, multa_atraso_percent: Number(e.target.value) })}
                    className="w-full rounded-lg border-slate-200 pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Aplicada uma única vez após o vencimento.
                </p>
              </div>

              {/* Juros Diários */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Percent className="h-3.5 w-3.5 text-slate-400" />
                  Juros Diários (Mora)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={config.juros_diarios_percent}
                    onChange={(e) => setConfig({ ...config, juros_diarios_percent: Number(e.target.value) })}
                    className="w-full rounded-lg border-slate-200 pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Acumulado a cada dia de atraso.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: POLÍTICA DE INADIMPLÊNCIA */}
          <div className="rounded-xl border border-red-100 bg-red-50/30 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Restrição Automática</h3>
                  
                  {/* Toggle Switch */}
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={config.bloquear_inadimplentes}
                      onChange={(e) => setConfig({ ...config, bloquear_inadimplentes: e.target.checked })}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300"></div>
                  </label>
                </div>
                
                <p className="mt-1 text-xs text-slate-600">
                  Se ativado, alunos com mensalidades vencidas há mais de 30 dias terão o acesso ao Portal do Aluno bloqueado automaticamente.
                </p>
                {config.bloquear_inadimplentes && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800">
                    <AlertTriangle className="h-3 w-3" />
                    Modo rigoroso ativado. Certifique-se que isso está no contrato.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CARD 3: CTA PARA TABELA DE PREÇOS */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100 text-slate-600">
                <Landmark className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tabela de Preços & Contas</h3>
                <p className="text-xs text-slate-500">
                  Gerencie o valor das propinas por classe e contas bancárias.
                </p>
              </div>
            </div>
            
            <Link
              href={escolaId ? `/escola/${escolaId}/financeiro/configuracoes` : "#"}
              className="group inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              Abrir Gestão Financeira Completa
              <ExternalLink className="h-3 w-3 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

        </div>
      )}
    </ConfigSystemShell>
  );
}

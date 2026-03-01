"use client";

/**
 * CobrancasListClient — Super Admin Billing Portal
 * Design: Light Management — clareza, profissionalismo, consistência.
 * Tokens KLASSE: #1F6B3B (green), #E3B23C (gold).
 */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";
import AssinaturaDetailsSlideover from "./AssinaturaDetailsSlideover";
import { AlertTriangle } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AssinaturaPendente = {
  id: string;
  escola_id: string;
  escola_nome: string;
  plano: PlanTier;
  ciclo: 'mensal' | 'anual';
  valor_kz: number;
  data_renovacao: string;
  metodo_pagamento: string;
  status: string;
  origem_registo?: string | null;
  motivo_origem?: string | null;
  pagamento_id?: string;
  comprovativo_url?: string;
  referencia_ext?: string;
  created_at: string;
};

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const PLAN_META: Record<PlanTier, { pill: string; dot: string }> = {
  essencial:    { pill: "bg-slate-100 border border-slate-200 text-slate-600",  dot: "bg-slate-400"   },
  profissional: { pill: "bg-[#E3B23C]/10 border border-[#E3B23C]/20 text-[#B48924]", dot: "bg-[#E3B23C]" },
  premium:      { pill: "bg-[#1F6B3B]/10 border border-[#1F6B3B]/20 text-[#1F6B3B]", dot: "bg-[#1F6B3B]" },
};

function PlanBadge({ plano }: { plano: PlanTier }) {
  const m = PLAN_META[plano] || PLAN_META.essencial;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${m.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {PLAN_NAMES[plano]}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActiva = status === 'activa';
  const isPendente = status === 'pendente';
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
      ${isActiva ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
        isPendente ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
        'bg-slate-100 text-slate-600 border border-slate-200'}`}>
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, j) => (
        <td key={j} className="py-4 px-4">
          <div className="h-3 rounded bg-slate-100 animate-pulse" style={{ width: `${35 + (j * 17) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CobrancasListClient() {
  const [items, setItems] = useState<AssinaturaPendente[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [erro, setErro] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncReport, setSyncReport] = useState<{ total_escolas_sync: number; assinaturas_criadas: number; escolas_criadas: Array<{ escola_id: string; escola_nome: string; plano: PlanTier; ciclo: "mensal" | "anual"; valor_kz: number; }>; pendentes_parametrizacao: number; escolas_pendentes_parametrizacao: Array<{ escola_id: string; escola_nome: string; plano: PlanTier; ciclo: "mensal" | "anual"; motivo: string; }>; } | null>(null);

  const supabase = createClient();

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/super-admin/billing/sync-assinaturas', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao sincronizar');
      setSyncReport(json.report_super_admin ?? null);
      toast.success(json.message || 'Sincronização concluída');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao sincronizar: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setErro(null);

      const { data, error } = await supabase
        .from('assinaturas')
        .select(`
          *,
          escolas:escola_id (nome),
          pagamentos:pagamentos_saas (
            id,
            status,
            comprovativo_url,
            referencia_ext,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized: AssinaturaPendente[] = (data || []).map(row => {
        const ultimoPg = row.pagamentos?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        return {
          id: row.id,
          escola_id: row.escola_id,
          escola_nome: (row.escolas as any)?.nome || 'Escola Desconhecida',
          plano: row.plano as PlanTier,
          ciclo: row.ciclo as any,
          valor_kz: row.valor_kz,
          data_renovacao: row.data_renovacao,
          metodo_pagamento: row.metodo_pagamento,
          status: row.status,
          origem_registo: row.origem_registo,
          motivo_origem: row.motivo_origem,
          pagamento_id: ultimoPg?.id,
          comprovativo_url: ultimoPg?.comprovativo_url || undefined,
          referencia_ext: ultimoPg?.referencia_ext,
          created_at: row.created_at
        } as AssinaturaPendente;
      });

      setItems(normalized);
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar cobranças');
      toast.error('Falha ao carregar dados de faturação');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmar = async (item: AssinaturaPendente) => {
    if (!confirm('Deseja confirmar o pagamento desta subscrição?')) return;

    try {
      setConfirmingId(item.id);

      const res = await fetch(`/api/super-admin/billing/assinaturas/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_receipt', pagamento_id: item.pagamento_id ?? null }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao confirmar comprovativo');

      toast.success(`Subscrição de ${item.escola_nome} activada!`);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao confirmar: ' + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const cols = ["Escola", "Plano / Ciclo", "Valor", "Status", "Pagamento", "Renovação", "Acções"];

  const pendentesParametrizacao = useMemo(
    () => items.filter((item) => item.status === "pendente" && item.valor_kz <= 0),
    [items],
  );

  return (
    <div className="text-slate-900">
      
      {syncReport && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Relatório de bootstrap para revisão Super Admin</p>
          <p className="mt-1 text-xs text-amber-800">
            {syncReport.total_escolas_sync} escola(s) no sync; {syncReport.assinaturas_criadas} assinatura(s) criada(s); {syncReport.pendentes_parametrizacao} pendente(s) de parametrização.
          </p>
          {syncReport.escolas_criadas.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Escolas com assinatura criada</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-900">
                {syncReport.escolas_criadas.map((escola) => (
                  <li key={escola.escola_id}>
                    • {escola.escola_nome} ({PLAN_NAMES[escola.plano]} / {escola.ciclo}) — Kz {escola.valor_kz.toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {syncReport.escolas_pendentes_parametrizacao.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">Escolas pendentes de parametrização</p>
              <ul className="mt-1 space-y-1 text-xs text-red-800">
                {syncReport.escolas_pendentes_parametrizacao.map((escola) => (
                  <li key={escola.escola_id}>
                    • {escola.escola_nome} ({PLAN_NAMES[escola.plano]} / {escola.ciclo}) — {escola.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {pendentesParametrizacao.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-700">Assinaturas pendentes de parametrização</p>
            <p className="mt-1 text-xs text-red-800">
              {pendentesParametrizacao.length} assinatura(s) com valor_kz inválido ou pendência de configuração inicial. Rever e parametrizar antes da activação.
            </p>
          </div>
        </div>
      )}

      {/* ── Dashboard Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">MRR Estático</p>
          <p className="text-2xl font-bold text-slate-900">
            Kz {items.filter(i => i.status === 'activa' && i.ciclo === 'mensal').reduce((acc, i) => acc + i.valor_kz, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">
            {items.filter(i => i.status === 'pendente').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Escolas Activas</p>
          <p className="text-2xl font-bold text-emerald-600">
            {items.filter(i => i.status === 'activa').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Kz (Global)</p>
          <p className="text-2xl font-bold text-slate-500">
            Kz {items.reduce((acc, i) => acc + i.valor_kz, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── Tabela Principal ── */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Controlo de Subscrições</p>
            <p className="text-[10px] text-slate-400">Gestão global de contratos e planos ativos</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase hover:bg-amber-100 transition-all disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Inicializar Assinaturas'}
            </button>
            <button 
              onClick={loadData} 
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-[10px] font-bold uppercase hover:bg-slate-50 transition-all"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                {cols.map(h => (
                  <th key={h} className="py-3 px-6 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <p className="text-slate-400 text-sm italic">Nenhuma subscrição registada no sistema.</p>
                  </td>
                </tr>
              )}

              {!loading && items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-900">{item.escola_nome}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.id.slice(0,8)}</p>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col gap-1.5 items-start">
                      <PlanBadge plano={item.plano} />
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                        Ciclo: {item.ciclo}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-slate-700 font-mono font-semibold">Kz {item.valor_kz.toLocaleString()}</p>
                    {item.status === 'pendente' && item.valor_kz <= 0 && (
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-600">Parametrização obrigatória</p>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-4 px-6">
                    {item.comprovativo_url ? (
                      <button 
                        onClick={() => window.open(item.comprovativo_url, '_blank')}
                        className="flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase hover:text-amber-700"
                      >
                        📄 Ver Comprovativo
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-300 uppercase italic">Sem prova</span>
                    )}
                    {item.referencia_ext && (
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">Ref: {item.referencia_ext}</p>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-xs text-slate-500">
                      {format(new Date(item.data_renovacao), "dd 'de' MMM, yyyy", { locale: pt })}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      {item.status === 'pendente' && (
                        <button
                          disabled={confirmingId === item.id}
                          onClick={() => handleConfirmar(item)}
                          className="px-3 py-1.5 rounded-lg bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white text-[10px] font-bold uppercase transition-colors disabled:opacity-50 shadow-sm"
                        >
                          {confirmingId === item.id ? '...' : 'Activar'}
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedId(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold uppercase transition-colors"
                      >
                        Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slideover de Detalhes ── */}
      {selectedId && (
        <AssinaturaDetailsSlideover 
          assinaturaId={selectedId} 
          onClose={() => setSelectedId(null)} 
          onUpdated={loadData}
        />
      )}
    </div>
  );
}

"use client";

/**
 * CobrancasListClient — Super Admin Billing Portal
 * Design: Light Management — clareza, profissionalismo, consistência.
 * Tokens KLASSE: #1F6B3B (green), #E3B23C (gold).
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";

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

  const supabase = createClient();

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/super-admin/billing/sync-assinaturas', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao sincronizar');
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
      
      const novaDataRenovacao = new Date(item.data_renovacao);
      if (item.ciclo === 'mensal') novaDataRenovacao.setMonth(novaDataRenovacao.getMonth() + 1);
      else novaDataRenovacao.setFullYear(novaDataRenovacao.getFullYear() + 1);

      const { error: assError } = await supabase
        .from('assinaturas')
        .update({
          status: 'activa',
          data_renovacao: novaDataRenovacao.toISOString()
        })
        .eq('id', item.id);

      if (assError) throw assError;

      if (item.pagamento_id) {
        const { error: pgError } = await supabase
          .from('pagamentos_saas')
          .update({
            status: 'confirmado',
            confirmado_por: (await supabase.auth.getUser()).data.user?.id,
            confirmado_em: new Date().toISOString()
          })
          .eq('id', item.pagamento_id);
        
        if (pgError) throw pgError;
      }

      toast.success(`Subscrição de ${item.escola_nome} activada!`);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao confirmar: ' + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const cols = ["Escola", "Plano / Ciclo", "Valor", "Status", "Pagamento", "Renovação", "Acções"];

  return (
    <div className="bg-slate-50/30 min-h-screen text-slate-900">
      
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
                      <button className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold uppercase transition-colors">
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
    </div>
  );
}

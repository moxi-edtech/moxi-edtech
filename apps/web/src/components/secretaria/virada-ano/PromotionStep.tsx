"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Settings2,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/Button";

type StudentInfo = {
    id: string;
    nome: string;
    turma: string;
    classe: string;
    saldo: number;
};

type PromotionSummary = {
  total: number;
  counts: {
    aptos: number;
    inadimplentes: number;
    retidos: number;
  };
  lists: {
    aptos: StudentInfo[];
    inadimplentes: StudentInfo[];
    retidos: StudentInfo[];
  };
};

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function PromotionStep({ onComplete }: { onComplete: () => void }) {
  const [summary, setSummary] = useState<PromotionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tolerance, setTolerance] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSummary = async (tol: number) => {
    setLoading(true);
    try {
        const res = await fetch(`/api/secretaria/operacoes-academicas/virada/promotion-summary?tolerance=${tol}`);
        const json = await res.json();
        if (json.ok) setSummary(json.summary);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(tolerance);
  }, [tolerance]);

  const filteredLists = useMemo(() => {
      if (!summary) return null;
      const filter = (list: StudentInfo[]) => 
          list.filter(s => s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || s.turma.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return {
          aptos: filter(summary.lists.aptos),
          inadimplentes: filter(summary.lists.inadimplentes),
          retidos: filter(summary.lists.retidos)
      };
  }, [summary, searchTerm]);

  if (loading && !summary) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-slate-300" /></div>;

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2">
      
      {/* 1. Configuração de Tolerância */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-none">Tolerância Financeira</h3>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">Amnistia automática para virada</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <span className="pl-3 text-xs font-bold text-slate-500">AOA</span>
                  <input 
                    type="number"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-24 h-9 rounded-lg border-none bg-transparent px-2 text-sm font-black text-slate-800 outline-none focus:ring-0"
                    placeholder="0"
                  />
                  <Button size="sm" tone="gray" variant="ghost" onClick={() => fetchSummary(tolerance)}>Aplicar</Button>
              </div>
          </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase">Alunos Aptos</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{summary?.counts.aptos}</div>
          <p className="text-[10px] text-slate-400 mt-1">Sinal verde para promoção.</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Bloqueados (Dívida)</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{summary?.counts.inadimplentes}</div>
          <p className="text-[10px] text-slate-400 mt-1">Rematrícula travada no Ledger.</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-rose-600 mb-2">
            <XCircle className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Bloqueados (Notas)</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{summary?.counts.retidos}</div>
          <p className="text-[10px] text-slate-400 mt-1">Reprovados academicamente.</p>
        </div>
      </div>

      {/* 2. Filtro de Busca */}
      <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <input 
            type="text"
            placeholder="Procurar aluno ou turma na simulação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-klasse-gold/10 transition-all"
          />
      </div>

      {/* 3. Listas Detalhadas */}
      <div className="space-y-3">
          {/* Inadimplentes */}
          <div className={`rounded-2xl border transition-all ${expanded === 'inadimplentes' ? 'border-amber-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
              <button 
                onClick={() => setExpanded(expanded === 'inadimplentes' ? null : 'inadimplentes')}
                className="w-full px-5 py-4 flex items-center justify-between"
              >
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600"><AlertCircle className="h-4 w-4" /></div>
                      <span className="text-sm font-bold text-slate-700">Ver Alunos com Dívida ({summary?.counts.inadimplentes})</span>
                  </div>
                  {expanded === 'inadimplentes' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              
              {expanded === 'inadimplentes' && (
                  <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {filteredLists?.inadimplentes.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                  <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-800">{s.nome}</span>
                                      <span className="text-[10px] text-slate-400">{s.classe} · {s.turma}</span>
                                  </div>
                                  <span className="text-xs font-black text-rose-600">{money.format(s.saldo)}</span>
                              </div>
                          ))}
                          {filteredLists?.inadimplentes.length === 0 && <p className="text-center py-4 text-xs text-slate-400">Nenhum aluno encontrado nesta categoria.</p>}
                      </div>
                  </div>
              )}
          </div>

          {/* Retidos */}
          <div className={`rounded-2xl border transition-all ${expanded === 'retidos' ? 'border-rose-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
              <button 
                onClick={() => setExpanded(expanded === 'retidos' ? null : 'retidos')}
                className="w-full px-5 py-4 flex items-center justify-between"
              >
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600"><XCircle className="h-4 w-4" /></div>
                      <span className="text-sm font-bold text-slate-700">Ver Alunos Reprovados ({summary?.counts.retidos})</span>
                  </div>
                  {expanded === 'retidos' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              
              {expanded === 'retidos' && (
                  <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {filteredLists?.retidos.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                  <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-800">{s.nome}</span>
                                      <span className="text-[10px] text-slate-400">{s.classe} · {s.turma}</span>
                                  </div>
                                  <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Reprovado</span>
                              </div>
                          ))}
                          {filteredLists?.retidos.length === 0 && <p className="text-center py-4 text-xs text-slate-400">Nenhum aluno encontrado nesta categoria.</p>}
                      </div>
                  </div>
              )}
          </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex gap-3 shadow-sm">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed font-medium">
              Esta simulação utiliza o estado atual do <strong>Ledger Financeiro</strong> e o <strong>Histórico de Notas</strong>. 
              Ao avançar, os alunos bloqueados não serão transportados para o novo ano, permanecendo em estado de "pendência" na secretaria.
          </p>
      </div>

    </div>
  );
}

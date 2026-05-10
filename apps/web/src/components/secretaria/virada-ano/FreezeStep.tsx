"use client";

import { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  FileText, 
  Loader2, 
  RefreshCcw, 
  AlertTriangle,
  Play,
  Download,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/FeedbackSystem";

type PautaStatus = {
  total: number;
  geradas: number;
  pendentes_count: number;
  pendentes_list: string[];
};

type JobStatus = {
  id: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  total_turmas: number;
  processed: number;
  success_count: number;
  failed_count: number;
};

export function FreezeStep({ onComplete }: { onComplete: () => void }) {
  const [stats, setStats] = useState<PautaStatus | null>(null);
  const [activeJob, setActiveJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  
  const { success, error } = useToast();

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/pautas-status", { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) {
        setStats(json.stats);
        setActiveJob(json.active_job);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh se houver um job processando
    const timer = setInterval(() => {
      if (activeJob?.status === "PROCESSING") {
        fetchStatus();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeJob?.status]);

  const handleStartJob = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/gerar-pautas-lote", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        success("Geração de pautas iniciada em lote.");
        fetchStatus();
      } else {
        error(json.error || "Falha ao iniciar geração.");
      }
    } finally {
      setStarting(false);
    }
  };

  if (loading && !stats) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-slate-300" /></div>;

  const isComplete = stats && stats.pendentes_count === 0;
  const progressPercent = activeJob ? Math.round((activeJob.processed / activeJob.total_turmas) * 100) : 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {/* 1. Status das Pautas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pautas Anuais Oficiais</p>
          <div className="mt-3 flex items-end justify-between">
            <div className="text-3xl font-black text-slate-900">
              {stats?.geradas} <span className="text-sm font-medium text-slate-400">de {stats?.total}</span>
            </div>
            {isComplete ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4" /> 100% Gerado
              </div>
            ) : (
               <div className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                 {stats?.pendentes_count} Pendentes
               </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-center">
            {activeJob?.status === "PROCESSING" ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500 uppercase tracking-tighter">Processando Lote...</span>
                        <span className="text-klasse-green">{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-klasse-green transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 text-center italic">Isto pode levar alguns minutos. Pode continuar navegando.</p>
                </div>
            ) : isComplete ? (
                <div className="text-center py-2">
                     <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-1" />
                     <p className="text-xs font-bold text-slate-700">Tudo pronto para o congelamento.</p>
                </div>
            ) : (
                <Button 
                    tone="gold" 
                    className="w-full h-12 gap-2 font-bold" 
                    onClick={handleStartJob}
                    loading={starting}
                    disabled={stats?.total === 0}
                >
                    <Play className="h-4 w-4 fill-current" /> Gerar Pautas em Lote
                </Button>
            )}
        </div>
      </div>

      {/* 2. Lista de Pendências */}
      {!isComplete && stats && stats.pendentes_count > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Turmas Pendentes</h3>
                  <button onClick={fetchStatus} className="text-slate-400 hover:text-slate-600"><RefreshCcw className="h-3.5 w-3.5" /></button>
              </div>
              <div className="p-4 max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
                  {stats.pendentes_list.map((nome, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          <FileText className="h-3 w-3 text-slate-400" />
                          <span className="truncate font-medium">{nome}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 3. Aviso de Segurança */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
              <p className="text-sm font-bold text-blue-900">Sobre o Congelamento Acadêmico</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                  A geração das pautas anuais oficiais é o requisito final para "liquidar" o ano académico. 
                  Uma vez gerada a pauta de uma turma, o sistema aplicará um <strong>Hard Lock</strong>, 
                  impedindo qualquer alteração de notas ou faltas sem autorização especial do Diretor.
              </p>
          </div>
      </div>

      {isComplete && (
          <div className="pt-4 flex justify-center animate-bounce">
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                  Sinal Verde: Pautas Liquidadas. Pode avançar para a Configuração do Ano Novo.
              </div>
          </div>
      )}
    </div>
  );
}

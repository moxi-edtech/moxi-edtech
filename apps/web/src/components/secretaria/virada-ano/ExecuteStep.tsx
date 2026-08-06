"use client";

import { useState } from "react";
import { 
  Rocket, 
  ShieldAlert, 
  CheckCircle2, 
  Lock,
  ArrowRightCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/FeedbackSystem";

type CutoverResponse = {
  ok?: boolean;
  error?: string;
  result?: Record<string, unknown>;
};

export function ExecuteStep({ onComplete, fromSession, toSession, retroactivePending = false, completed = false }: { onComplete: () => void, fromSession: string, toSession: string, retroactivePending?: boolean, completed?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [allowRetroactivePending, setAllowRetroactivePending] = useState(retroactivePending);
  const [result, setResult] = useState<Record<string, unknown> | null>(completed ? {} : null);
  
  const { success, error: toastError } = useToast();

  const handleFinalCutover = async () => {
    setExecuting(true);
    try {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/cutover", {
        method: "POST",
        body: JSON.stringify({
          from_session_id: fromSession,
          to_session_id: toSession,
          cutover_mode: allowRetroactivePending ? "retroactive_pending" : "standard",
        }),
      });
      const json = (await res.json()) as CutoverResponse;
      if (json.ok) {
        success("VIRADA CONCLUÍDA! O sistema agora opera no ano novo.");
        setResult(json.result ?? {});
        onComplete();
      } else {
        toastError(json.error || "Falha crítica na virada atômica.");
      }
    } finally {
      setExecuting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-8 animate-in zoom-in-95">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-xl shadow-emerald-500/10">
            <div className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-emerald-500/40">
                <CheckCircle2 className="h-12 w-12" />
            </div>
            <h3 className="text-2xl font-black text-emerald-900">Operação Bem Sucedida!</h3>
            <p className="text-slate-600 mt-2 font-medium">O ciclo académico foi encerrado e o novo ano está 100% operacional.</p>
            
            <div className="mt-10 flex flex-col gap-3 max-w-sm mx-auto">
                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase">Snapshot Histórico</span>
                    <span className="text-xs font-black text-emerald-600 uppercase">LOCKED</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase">Alunos Promovidos</span>
                    <span className="text-xs font-black text-slate-800">Ver Relatório</span>
                </div>
            </div>

            <Button tone="gold" className="mt-10 h-12 px-10 font-black shadow-lg" onClick={() => window.location.reload()}>
                Recarregar Sistema
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="rounded-2xl border-2 border-rose-100 bg-rose-50/30 p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-black text-rose-900 uppercase tracking-tighter">Ponto de Não Retorno</h3>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            Ao clicar em confirmar, o sistema realizará a virada atômica. Esta operação é <strong>auditada</strong> e <strong>irreversível</strong> em produção.
          </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <input
            type="checkbox"
            checked={allowRetroactivePending}
            onChange={(event) => setAllowRetroactivePending(event.target.checked)}
            className="mt-1 h-4 w-4 accent-amber-600"
          />
          <span className="text-left text-xs leading-relaxed text-amber-900">
            <strong>Virada retroativa com pendências académicas.</strong> Arquivar o ano anterior mesmo com notas, pautas ou documentos incompletos. Promover todos os alunos sem saldo devedor e manter devedores em pendência para regularização.
          </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Estado Atual</span>
              <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-rose-500" />
                  <span className="text-lg font-black text-slate-800 uppercase tracking-tight">Congelado</span>
              </div>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Novo Estado</span>
              <div className="flex items-center gap-3">
                  <Rocket className="h-5 w-5 text-emerald-400 animate-bounce" />
                  <span className="text-lg font-black text-white uppercase tracking-tight">Ativo</span>
              </div>
          </div>
      </div>

      {!confirming ? (
          <div className="pt-6 flex justify-center">
              <Button 
                tone="gold" 
                className="h-14 px-12 gap-3 font-black text-lg shadow-xl hover:shadow-2xl transition-all rounded-2xl"
                onClick={() => setConfirming(true)}
              >
                  Executar Virada Atômica <ArrowRightCircle className="h-6 w-6" />
              </Button>
          </div>
      ) : (
          <div className="pt-6 space-y-4 text-center animate-in fade-in zoom-in-95">
              <p className="text-sm font-bold text-slate-700">Deseja realmente prosseguir com a promoção em massa?</p>
              <div className="flex justify-center gap-3">
                  <Button tone="gray" variant="ghost" className="h-12 px-8 font-bold" onClick={() => setConfirming(false)} disabled={executing}>
                      Cancelar
                  </Button>
                  <Button tone="gold" className="h-12 px-12 gap-2 font-black shadow-lg" onClick={handleFinalCutover} loading={executing}>
                      Sim, Confirmar Agora
                  </Button>
              </div>
          </div>
      )}
    </div>
  );
}

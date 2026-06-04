"use client";

import { useEffect, useState } from "react";
import { GraduationCap, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { Button } from "@/components/ui/Button";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";

type RematriculaStatus = {
  ok: boolean;
  eligible?: boolean;
  alreadyDone?: boolean;
  status?: string;
  hasDebt?: boolean;
  nextAno?: number;
  reason?: string;
};

export function RematriculaBanner() {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<RematriculaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch("/api/aluno/rematricula/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const handleConfirmar = async () => {
    if (!status?.nextAno) return;

    const confirmed = await confirm({
      title: "Confirmar Rematrícula",
      message: `Deseja confirmar sua matrícula para o ano letivo de ${status.nextAno}? Sua vaga será reservada e o processo será enviado para a secretaria.`,
      confirmLabel: "Sim, Confirmar",
      cancelLabel: "Cancelar",
    });

    if (!confirmed) return;

    setConfirming(true);
    try {
      const res = await fetch("/api/aluno/rematricula/confirmar", {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        success("Sucesso!", "Sua rematrícula foi solicitada e enviada para a secretaria.");
        setStatus({ ...status, eligible: false, alreadyDone: true, status: "submetida" });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Erro na Rematrícula", err.message || "Ocorreu um erro ao processar sua solicitação.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return null; // Não mostra nada enquanto carrega

  // Não mostrar se não houver próximo ano aberto ou se já não for elegível por motivos gerais e não tentou fazer
  if (!status?.eligible && !status?.alreadyDone && !status?.hasDebt) return null;

  return (
    <AlunoCard className={`border-2 ${status.alreadyDone ? 'border-klasse-green-200 bg-klasse-green-50/50' : status.hasDebt ? 'border-red-200 bg-red-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-4 items-start">
          <div className={`p-3 rounded-full flex-shrink-0 ${status.alreadyDone ? 'bg-klasse-green-100 text-klasse-green-600' : status.hasDebt ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {status.alreadyDone ? <CheckCircle2 className="h-6 w-6" /> : status.hasDebt ? <AlertTriangle className="h-6 w-6" /> : <GraduationCap className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {status.alreadyDone ? `Rematrícula Solicitada (${status.nextAno || 'Próximo Ano'})` : `Rematrícula ${status.nextAno} Aberta!`}
            </h3>
            <p className="mt-1 text-xs text-slate-600 max-w-lg">
              {status.reason}
            </p>
          </div>
        </div>

        {status.eligible && !status.alreadyDone && !status.hasDebt && (
          <Button 
            onClick={handleConfirmar} 
            disabled={confirming}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar Vaga
          </Button>
        )}
      </div>
    </AlunoCard>
  );
}

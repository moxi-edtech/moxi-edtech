"use client";

import { useState } from "react";

type Props = {
  activeYearId: string | null;
  metrics: {
    turmas_session_id_null: number;
    matriculas_session_id_null: number;
    mensalidades_competencia_fora_janela: number;
    mensalidades_sem_matricula_id: number;
    curriculos_classes_pendentes: number;
    pautas_anuais_pendentes: number;
    snapshot_locks_pendentes: number;
    matriculas_status_final_pendente: number;
  };
};

type ActionKey =
  | "fix_sessions"
  | "fix_orphan_mensalidades"
  | "fix_competencia_mensalidades"
  | "publish_pending_curriculos"
  | "generate_pautas_anuais"
  | "close_year_snapshots";

const labels: Record<ActionKey, string> = {
  fix_sessions: "Backfill de sessões",
  fix_orphan_mensalidades: "Reconciliar mensalidades órfãs",
  fix_competencia_mensalidades: "Reancorar competências",
  publish_pending_curriculos: "Publicar currículos pendentes",
  generate_pautas_anuais: "Gerar pautas anuais",
  close_year_snapshots: "Fechar ano e snapshots",
};

export function CutoverResolveActions({ activeYearId, metrics }: Props) {
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [result, setResult] = useState<string>("");

  const runAction = async (action: ActionKey, dryRun: boolean) => {
    setLoading(action);
    setResult("");
    try {
      let res: Response;
      if (action === "generate_pautas_anuais") {
        res = dryRun
          ? await fetch("/api/secretaria/operacoes-academicas/virada/pautas-status", { cache: "no-store" })
          : await fetch("/api/secretaria/operacoes-academicas/virada/gerar-pautas-lote", { method: "POST" });
      } else if (action === "close_year_snapshots") {
        if (!activeYearId) throw new Error("Ano letivo ativo não identificado.");
        res = dryRun
          ? await fetch(`/api/secretaria/fechamento-academico/sanidade?acao=fechar_ano&ano_letivo_id=${activeYearId}`, { cache: "no-store" })
          : await fetch("/api/secretaria/fechamento-academico", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                acao: "fechar_ano",
                ano_letivo_id: activeYearId,
                motivo: "Fechamento anual iniciado pelo SSOT de virada.",
                executar_assincrono: true,
              }),
            });
      } else {
        res = await fetch("/api/secretaria/operacoes-academicas/virada/remediate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, dryRun }),
        });
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao executar ação.");
      }

      const summary = json?.result ? JSON.stringify(json.result) : JSON.stringify(json);
      setResult(`${dryRun ? "Simulação" : "Execução"} (${labels[action]}) concluída.`);

      if (!dryRun) {
        setTimeout(() => window.location.reload(), action === "close_year_snapshots" ? 1500 : 500);
      } else {
        console.info("[cutover-action:dry-run]", summary);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      setResult(`Erro: ${message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">Ações diretas de resolução</p>
      <p className="mt-1 text-[11px] text-slate-500">Cada bloqueador tem ação no mesmo painel. Use simulação antes de executar.</p>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-slate-700">Sessões nulas</p>
          <p className="text-[11px] text-slate-500">Turmas+Matrículas: {metrics.turmas_session_id_null + metrics.matriculas_session_id_null}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => runAction("fix_sessions", false)} disabled={loading !== null} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Resolver agora</button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-slate-700">Mensalidades órfãs</p>
          <p className="text-[11px] text-slate-500">Total: {metrics.mensalidades_sem_matricula_id}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => runAction("fix_orphan_mensalidades", true)} disabled={loading !== null} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Simular</button>
            <button onClick={() => runAction("fix_orphan_mensalidades", false)} disabled={loading !== null || metrics.mensalidades_sem_matricula_id === 0} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Resolver agora</button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-slate-700">Competência fora da janela</p>
          <p className="text-[11px] text-slate-500">Total: {metrics.mensalidades_competencia_fora_janela}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => runAction("fix_competencia_mensalidades", true)} disabled={loading !== null} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Simular</button>
            <button onClick={() => runAction("fix_competencia_mensalidades", false)} disabled={loading !== null || metrics.mensalidades_competencia_fora_janela === 0} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Resolver agora</button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-slate-700">Currículo pendente por classe</p>
          <p className="text-[11px] text-slate-500">Total: {metrics.curriculos_classes_pendentes}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => runAction("publish_pending_curriculos", true)} disabled={loading !== null} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Simular</button>
            <button onClick={() => runAction("publish_pending_curriculos", false)} disabled={loading !== null || metrics.curriculos_classes_pendentes === 0} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Resolver agora</button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-slate-700">Pautas anuais oficiais</p>
          <p className="text-[11px] text-slate-500">Pendentes: {metrics.pautas_anuais_pendentes}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => runAction("generate_pautas_anuais", true)} disabled={loading !== null} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Simular</button>
            <button onClick={() => runAction("generate_pautas_anuais", false)} disabled={loading !== null || metrics.pautas_anuais_pendentes === 0} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Gerar lote</button>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-slate-700">Fechamento anual e snapshots</p>
          <p className="text-[11px] text-slate-500">Matrículas sem final: {metrics.matriculas_status_final_pendente} · Snapshots: {metrics.snapshot_locks_pendentes}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => runAction("close_year_snapshots", true)} disabled={loading !== null || !activeYearId} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Simular</button>
            <button onClick={() => runAction("close_year_snapshots", false)} disabled={loading !== null || !activeYearId || (metrics.matriculas_status_final_pendente === 0 && metrics.snapshot_locks_pendentes === 0)} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50">Fechar ano</button>
          </div>
        </div>
      </div>

      {loading && <p className="mt-2 text-[11px] text-slate-500">Executando: {labels[loading]}...</p>}
      {result && <p className="mt-2 text-[11px] text-slate-700">{result}</p>}
    </div>
  );
}

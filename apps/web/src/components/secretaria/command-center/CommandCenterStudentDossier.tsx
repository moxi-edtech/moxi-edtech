"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { DossierTabs } from "@/components/aluno/DossierTabs";
import { CurrentYearEnrollmentPanel } from "@/components/aluno/CurrentYearEnrollmentPanel";
import {
  DossierDocumentosSection,
  DossierFinanceiroSection,
  DossierHistoricoSection,
  DossierHistoricoTransitadoSection,
  DossierPerfilSection,
} from "@/components/aluno/DossierSeccoes";
import type { AlunoNormalizado } from "@/lib/aluno/types";
import type { AlunoServicoFinanceiro } from "@/lib/financeiro/servicosPagamento";

type DossierResponse = {
  ok?: boolean;
  error?: string;
  aluno?: AlunoNormalizado;
  servicos?: AlunoServicoFinanceiro[];
};

export function CommandCenterStudentDossier({
  escolaId,
  alunoId,
  refreshKey = 0,
}: {
  escolaId: string;
  alunoId: string;
  refreshKey?: number;
}) {
  const [data, setData] = useState<{
    aluno: AlunoNormalizado;
    servicos: AlunoServicoFinanceiro[];
    schoolScope: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [lastConfirmedAt, setLastConfirmedAt] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    // Preserve the current student's snapshot while revalidating; never display
    // a different student's cached values after a context switch.
    setData(current => current?.aluno.id === alunoId && current.schoolScope === escolaId ? current : null);
    void fetch("/api/secretaria/alunos/" + encodeURIComponent(alunoId) + "/dossier", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => ({
        response,
        body: (await response.json().catch(() => ({}))) as DossierResponse,
      }))
      .then(({ response, body }) => {
        if (controller.signal.aborted) return;
        if (!response.ok || !body.ok || !body.aluno || body.aluno.id !== alunoId) {
          throw new Error(body.error || "Não foi possível carregar a ficha integral.");
        }
        setData({
          schoolScope: escolaId,
          aluno: body.aluno,
          servicos: Array.isArray(body.servicos) ? body.servicos : [],
        });
        setLastConfirmedAt(new Date());
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Falha ao carregar o perfil integral.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [alunoId, escolaId, refreshKey, retry]);



  if (loading && (!data || data.aluno.id !== alunoId || data.schoolScope !== escolaId)) {
    return (
      <div role="status" className="flex min-h-40 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar perfil, financeiro, histórico e documentos...
      </div>
    );
  }

  if (!data || data.aluno.id !== alunoId || data.schoolScope !== escolaId) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
        <p>{error || "Não foi possível carregar a ficha integral."}</p>
        <button
          type="button"
          onClick={() => setRetry((current) => current + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const { aluno, servicos } = data;
  const notConfirmed = loading || Boolean(error);
  return (
    <div className="space-y-3" aria-busy={loading}>
      <div role={error ? "alert" : "status"} aria-live="polite"
        className="min-h-8 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-700">
        {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Atualizando dados...</> : error
          ? "Não foi possível confirmar dados recentes. Ações estão temporariamente indisponíveis."
          : "Dados atualizados"}
        {lastConfirmedAt ? <time dateTime={lastConfirmedAt.toISOString()}>
          Última atualização: {lastConfirmedAt.toLocaleTimeString("pt-PT", {hour:"2-digit",minute:"2-digit",second:"2-digit"})}
        </time> : null}
      </div>
      <div inert={notConfirmed} aria-disabled={notConfirmed} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{aluno.perfil.nome}</p>
          <p className="text-xs text-slate-500">
            {aluno.perfil.numero_processo ? "Processo " + aluno.perfil.numero_processo : "Ficha do aluno"}
            {aluno.matricula_atual?.turma ? " · " + aluno.matricula_atual.turma : ""}
          </p>
        </div>
        <Link
          href={"/escola/" + encodeURIComponent(escolaId) + "/operacoes/alunos/" + encodeURIComponent(alunoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald hover:underline"
        >
          Abrir ficha completa
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <DossierTabs
        key={alunoId}
        workspace
        aluno={aluno}
        slotPerfil={(
          <div className="space-y-4">
            <DossierPerfilSection aluno={aluno} />
            <CurrentYearEnrollmentPanel
              alunoId={alunoId}
              escolaId={escolaId}
              onChanged={() => setRetry((current) => current + 1)}
            />
          </div>
        )}
        slotMatricula={<CurrentYearEnrollmentPanel alunoId={alunoId} escolaId={escolaId} onChanged={() => setRetry((current) => current + 1)} />}
        slotFinanceiro={<DossierFinanceiroSection aluno={aluno} role="secretaria" escolaId={escolaId} servicos={servicos} />}
        slotHistorico={<DossierHistoricoSection aluno={aluno} alunoId={alunoId} role="secretaria" escolaId={escolaId} />}
        slotHistoricoTransitado={<DossierHistoricoTransitadoSection alunoId={alunoId} canEdit />}
        slotDocumentos={<DossierDocumentosSection alunoId={alunoId} />}
      />
      </div>
    </div>
  );
}

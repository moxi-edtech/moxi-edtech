"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { DossierTabs } from "@/components/aluno/DossierTabs";
import { TransferForm } from "@/components/secretaria/TransferForm";
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
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [matriculaInfo, setMatriculaInfo] = useState<{ id: string; turmaId: string; ano: number; sessionId: string | null } | null>(null);
  const [matriculaError, setMatriculaError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    setMatriculaInfo(null);
    setMatriculaError(null);
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
          aluno: body.aluno,
          servicos: Array.isArray(body.servicos) ? body.servicos : [],
        });
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

  useEffect(() => {
    const controller = new AbortController();
    setMatriculaInfo(null);
    setMatriculaError(null);
    if (!data?.aluno.matricula_atual?.matricula_id) return () => controller.abort();
    const matriculaId = data.aluno.matricula_atual.matricula_id;
    void fetch("/api/secretaria/admissoes/matriculas/" + encodeURIComponent(matriculaId) + "/workspace-context", {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Não foi possível consultar a matrícula.");
      return body;
    }).then((body) => {
      if (!controller.signal.aborted) setMatriculaInfo(body.matricula);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setMatriculaError(cause instanceof Error ? cause.message : "Falha ao consultar matrícula.");
    });
    return () => controller.abort();
  }, [data]);

  if (loading) {
    return (
      <div role="status" className="flex min-h-40 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar perfil, financeiro, histórico e documentos...
      </div>
    );
  }

  if (error || !data) {
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
  return (
    <div className="space-y-3">
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
        slotPerfil={<DossierPerfilSection aluno={aluno} />}
        slotMatricula={
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Matrícula atual</h2>
            <p className="text-sm text-slate-600">Turma: {aluno.matricula_atual?.turma ?? "Não definida"}</p>
            <p className="text-sm text-slate-600">Classe: {aluno.matricula_atual?.classe ?? "Não definida"}</p>
            {matriculaError ? <p role="alert" className="text-sm text-red-700">{matriculaError}</p> : null}
            {matriculaInfo ? (
              <TransferForm
                matriculaId={matriculaInfo.id}
                currentTurmaId={matriculaInfo.turmaId}
                anoLetivo={matriculaInfo.ano}
                anoLetivoId={matriculaInfo.sessionId}
                onSuccess={() => setRetry((current) => current + 1)}
              />
            ) : !matriculaError ? <p className="text-sm text-slate-500">A carregar opções de retificação...</p> : null}
          </div>
        }
        slotFinanceiro={<DossierFinanceiroSection aluno={aluno} role="secretaria" servicos={servicos} />}
        slotHistorico={<DossierHistoricoSection aluno={aluno} alunoId={alunoId} role="secretaria" escolaId={escolaId} />}
        slotHistoricoTransitado={<DossierHistoricoTransitadoSection alunoId={alunoId} canEdit />}
        slotDocumentos={<DossierDocumentosSection alunoId={alunoId} />}
      />
    </div>
  );
}

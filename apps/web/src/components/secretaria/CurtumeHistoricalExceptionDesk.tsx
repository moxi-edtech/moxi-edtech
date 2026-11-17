"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, RefreshCw } from "lucide-react";
import { getHistoricBatchIssueAdvice } from "@/lib/academico/curtume-historic-batch-issues";

const CURTUME = "3744879f-2e19-4671-8995-78604302d8c5";
const API = "/api/operacoes/academico/fecho-historico-lote";

type PautaDisciplina = {
  id: string; nome: string | null; nota_final: number | null; referencia: string | null;
};
type OperationalGrade = {
  id: string; disciplina: string; avaliacao: string; trimestre: number | null;
  valor: number; is_isento: boolean; originVerified: boolean;
};
type ExceptionDossier = {
  ok: true;
  matricula_id: string;
  aluno_id: string;
  ano_letivo: "2025/2026";
  motivo: string;
  resultado_final: string;
  disciplinas_pauta: PautaDisciplina[];
  notas_operacionais: OperationalGrade[];
  sourceComplete: boolean;
};

type Props = {
  escolaId: string;
  escolaParam: string;
  alunoId: string;
  matriculaId: string;
  returnTo?: string | null;
};

export function CurtumeHistoricalExceptionDesk({
  escolaId, escolaParam, alunoId, matriculaId, returnTo,
}: Props) {
  const [dossier, setDossier] = useState<ExceptionDossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const supported = escolaId === CURTUME && /^[0-9a-f-]{36}$/i.test(matriculaId) &&
    /^[0-9a-f-]{36}$/i.test(alunoId);

  useEffect(() => {
    if (!supported) { setDossier(null); setError(null); setLoading(false); return; }
    const controller = new AbortController();
    setDossier(null); setLoading(true); setError(null);
    const params = new URLSearchParams({ matricula_id: matriculaId, aluno_id: alunoId });
    void fetch(API + "?" + params.toString(), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok || value.ok !== true)
          throw Error(value.error ?? "Não foi possível conferir a pendência.");
        if (value.matricula_id !== matriculaId || value.aluno_id !== alunoId ||
            value.ano_letivo !== "2025/2026")
          throw Error("A matrícula devolvida não corresponde ao aluno selecionado.");
        if (!controller.signal.aborted) setDossier(value as ExceptionDossier);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Falha ao consultar.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [alunoId, escolaId, matriculaId, revision, supported]);

  if (!supported) return null;

  const backHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : `/escola/${encodeURIComponent(escolaParam)}/operacoes/academico`;
  const reconciliationHref =
    `/escola/${encodeURIComponent(escolaParam)}/operacoes/academico/reconciliacao-historica?` +
    new URLSearchParams({ tipo: "historicos", ano: "2025", matricula_id: matriculaId }).toString();
  const advice = dossier ? getHistoricBatchIssueAdvice(dossier.motivo) : null;
  const hasOperational = Boolean(dossier?.notas_operacionais.length);
  const missingDocument = dossier?.motivo === "SEM_NOTAS_HISTORICAS";
  const wrongSource = dossier?.motivo === "ORIGEM_HISTORICA_INCOMPATIVEL";

  return (
    <section aria-label="Resolver pendência de 2025/2026"
      className="mb-4 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">CURTUME · 2025/2026</p>
          <h2 className="mt-1 font-semibold text-emerald">Pendência académica do ano anterior</h2>
          {loading && <p role="status" className="mt-2 text-muted-foreground">A verificar a matrícula…</p>}
          {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
          {advice && <div className="mt-2 space-y-1">
            <p className="font-semibold text-foreground">{advice.title}</p>
            <p className="text-xs text-muted-foreground">{advice.nextStep}</p>
          </div>}
        </div>
        <button type="button" onClick={() => setRevision((value) => value + 1)}
          disabled={loading} aria-label="Atualizar pendência"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>
      {dossier && (
        <div className="mt-4 space-y-3">
          {hasOperational ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <h3 className="font-semibold text-foreground">Pauta oficial · notas finais</h3>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {dossier.disciplinas_pauta.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>{item.nome ?? "Disciplina da pauta"}</span>
                      <span className="font-mono tabular-nums">{item.nota_final ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border p-3">
                <h3 className="font-semibold text-foreground">Avaliações operacionais preservadas</h3>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {dossier.notas_operacionais.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.disciplina} · {item.avaliacao}
                        {item.trimestre ? ` · ${item.trimestre}º trimestre` : ""}
                        {!item.originVerified && <span className="text-amber-700"> · vínculo a rever</span>}
                      </span>
                      <span className="font-mono tabular-nums">{item.is_isento ? "Isento" : item.valor}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Avaliações individuais não equivalem automaticamente à média final da pauta.
                  A reconciliação exige decisão auditada, sem eliminar notas.
                </p>
              </div>
            </div>
          ) : null}
          {missingDocument && (
            <p role="status" className="text-xs text-amber-700">
              Não há classificações históricas associadas a esta matrícula. Registe apenas notas
              comprovadas pela pauta física de 2025/2026; não utilize as notas do ano atual.
            </p>
          )}
          {wrongSource && (
            <p role="status" className="text-xs text-amber-700">
              Confira a matrícula e a classe de 2025/2026, sem alterar a turma de 2026/2027.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Link href={reconciliationHref}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 font-semibold text-white hover:brightness-95">
              <BookOpen className="h-4 w-4" />
              {hasOperational ? "Rever notas e decisão" :
                missingDocument ? "Rever pauta de 2025/2026" :
                  wrongSource ? "Rever matrícula de origem" : "Rever resultado e fechar"}
            </Link>
            <Link href={backHref}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">
              <ArrowLeft className="h-4 w-4" /> Voltar ao fecho em lote
            </Link>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            {hasOperational || missingDocument || wrongSource
              ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
              : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald" />}
            Depois de corrigir os dados autorizados, reexecute apenas o fecho dos históricos ainda abertos.
            Este painel não altera notas nem decisões automaticamente.
          </p>
        </div>
      )}
    </section>
  );
}

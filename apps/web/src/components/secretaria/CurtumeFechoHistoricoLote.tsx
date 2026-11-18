"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getHistoricBatchIssueAdvice, isHistoricBatchAcademicIssue } from "@/lib/academico/curtume-historic-batch-issues";

type Problema = {
  matricula_id: string;
  codigo: string;
  detalhe?: string;
  aluno_id?: string | null;
  aluno_nome?: string | null;
  numero_processo?: string | null;
  turma_nome?: string | null;
};
type BatchResult = {
  ok: boolean;
  lote_id: string;
  processados: number;
  fechados: number;
  bloqueados: number;
  cursor: string | null;
  terminou: boolean;
  pendencias: Problema[];
  error?: string;
};

const API = "/api/secretaria/operacoes-academicas/fecho-historico-lote";
const MAX_PAGES = 40; // 25 histories/chunk; bounds repeated or corrupted responses.

export function CurtumeFechoHistoricoLote({ onComplete, balcaoHref }: { onComplete?: () => void; balcaoHref?: string } = {}) {
  const [abertos, setAbertos] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [processados, setProcessados] = useState(0);
  const [fechados, setFechados] = useState(0);
  const [bloqueados, setBloqueados] = useState(0);
  const [pendencias, setPendencias] = useState<Problema[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [permitted, setPermitted] = useState(true);

  useEffect(() => {
    let live = true;
    void fetch(API, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403 || response.status === 401) {
          if (live) setPermitted(false);
          return null;
        }
        const data = await response.json();
        if (!response.ok || data?.ok !== true) throw Error(data.error || "Não foi possível obter o total.");
        if (live) setAbertos(Number(data.abertos ?? 0));
        return data;
      })
      .catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Falha ao consultar."); });
    return () => { live = false; };
  }, []);

  async function concluir() {
    if (running) return;
    if (!window.confirm(
      "Concluir em lote os históricos elegíveis de 2025/2026 da CURTUME, " +
      "conforme as notas já importadas? Apenas casos válidos serão ratificados e fechados. " +
      "As notas serão preservadas e os conflitos ficarão para revisão."
    )) return;
    setRunning(true);
    setDone(false);
    setError(null);
    setPendencias([]);
    setProcessados(0);
    setFechados(0);
    setBloqueados(0);

    const runId = crypto.randomUUID();
    let cursor: string | null = null;
    let finished = false;
    let count = 0, closed = 0, rejected = 0;
    const problems: Problema[] = [];
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await fetch(API, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "concluir_2025_2026",
            confirmacao: "CONFIRMO_PAUTAS_2025",
            lote_id: runId,
            cursor,
          }),
        });
        const data = await response.json() as BatchResult;
        if (!response.ok || !data.ok) throw Error(data.error ?? "O lote não foi concluído.");
        if (!Number.isInteger(data.processados) || data.processados < 0 ||
            !Number.isInteger(data.fechados) || data.fechados < 0 ||
            !Number.isInteger(data.bloqueados) || data.bloqueados < 0 ||
            data.fechados + data.bloqueados !== data.processados)
          throw Error("O servidor devolveu uma contagem académica inconsistente.");

        count += data.processados;
        closed += data.fechados;
        rejected += data.bloqueados;
        problems.push(...(data.pendencias ?? []));
        setProcessados(count);
        setFechados(closed);
        setBloqueados(rejected);
        setPendencias([...problems]);
        if (data.terminou) { finished = true; break; }
        if (!data.cursor || data.cursor === cursor)
          throw Error("O processamento foi interrompido para evitar repetição.");
        cursor = data.cursor;
      }
      if (!finished)
        throw Error("O lote ultrapassou o limite de páginas. Execute novamente para retomar.");
      setDone(true);
      setAbertos(rejected);
      onComplete?.();
    } catch (cause) {
      // Already-committed pupils remain legally closed. Retrying starts from
      // still-open records: no duplicate grades or repeated legal close.
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o lote.");
      onComplete?.();
    } finally {
      setRunning(false);
    }
  }

  if (!permitted) return null;
  return (
    <section aria-label="Fecho académico em lote de 2025/2026"
      className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
          <div>
            <h2 className="font-semibold text-emerald">Concluir ano 2025/2026 · CURTUME</h2>
            <p className="mt-1 text-muted-foreground">
              {abertos === null ? "A consultar históricos…" : `${abertos} históricos ainda abertos.`}
              {" "}Usar as pautas importadas, respeitar o RAA e separar apenas os conflitos.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void concluir()}
          disabled={running || !abertos}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-2.5 font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {running ? "A concluir…" : done && bloqueados > 0 ? "Reanalisar os pendentes" : "Concluir históricos elegíveis"}
        </button>
      </div>
      {(running || done || processados > 0) && (
        <div role="status" aria-live="polite" className="mt-3 border-t border-border pt-3 text-foreground">
          <span className="font-semibold">{fechados} fechados</span>
          {" · "}{bloqueados} para revisão
          {" · "}{processados} analisados
          {done && <span className="ml-2 text-emerald">Lote concluído.</span>}
        </div>
      )}
      {error && <p role="alert" className="mt-3 flex items-start gap-2 text-red-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />{error}
      </p>}
      {pendencias.some((issue) => !isHistoricBatchAcademicIssue(issue.codigo)) && (
        <p role="alert" className="mt-3 text-xs text-amber">
          Alguns registos não puderam ser processados por uma falha de validação.
          Repita o fecho; se persistir, contacte o suporte.
        </p>
      )}
      {pendencias.some((issue) => isHistoricBatchAcademicIssue(issue.codigo)) && (
        <section aria-label="Casos que exigem intervenção" className="mt-4 border-t border-border pt-4">
          <h3 className="font-semibold text-foreground">{pendencias.filter((issue) => isHistoricBatchAcademicIssue(issue.codigo)).length} casos para intervenção</h3>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {pendencias.map((issue, index) => {
              if (!isHistoricBatchAcademicIssue(issue.codigo)) return null;
              const advice = getHistoricBatchIssueAdvice(issue.codigo);
              const params = new URLSearchParams({
                alunoId: issue.aluno_id ?? "",
                action: "reenrollment",
                historicMatriculaId: issue.matricula_id,
                returnTo: balcaoHref ? balcaoHref.replace(/\/secretaria\/balcao(?:\?.*)?$/, "/operacoes/academico") : "/operacoes/academico",
              });
              const href = balcaoHref
                ? balcaoHref + (balcaoHref.includes("?") ? "&" : "?") + params.toString()
                : null;
              return (
                <div key={issue.matricula_id + "-" + index}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold text-foreground">
                      {issue.aluno_nome || ("Matrícula " + issue.matricula_id.slice(0, 8))}
                    </p>
                    {(issue.turma_nome || issue.numero_processo) && (
                      <p className="text-xs text-muted-foreground">
                        {[issue.turma_nome, issue.numero_processo ? "Processo " + issue.numero_processo : null]
                          .filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="text-xs font-semibold">{advice.title}</p>
                    <p className="text-xs text-muted-foreground">{advice.nextStep}</p>
                  </div>
                  {href && issue.aluno_id && (
                    <Link href={href}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-emerald hover:bg-muted">
                      Resolver no Balcão
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

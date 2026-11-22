"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Search } from "lucide-react";
import ArchiveTurmaRecordsPanel from "@/components/academico/ArchiveTurmaRecordsPanel";

type TurmaHistorica = {
  id: string;
  nome: string;
  codigo: string | null;
  classe: string | null;
  curso: string | null;
  turno: string | null;
};

type PageResponse = {
  ok?: boolean;
  error?: string;
  ano_letivo_id?: string;
  page?: number;
  page_size?: number;
  total?: number;
  items?: TurmaHistorica[];
};

export default function HistoricalTurmasPanel({
  academicYearId,
  yearLabel,
  escolaParam,
  portalBase,
}: {
  academicYearId: string;
  yearLabel: string;
  escolaParam: string | null;
  portalBase: string;
}) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [expandedTurmaId, setExpandedTurmaId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    const params = new URLSearchParams({
      ano_letivo_id: academicYearId,
      page: String(page),
    });
    if (query) params.set("q", query);
    if (escolaParam) params.set("escola_id", escolaParam);
    void fetch(`/api/secretaria/operacoes-academicas/arquivo/turmas?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({})) as PageResponse;
        if (!res.ok || !json.ok || json.ano_letivo_id !== academicYearId) {
          throw new Error(json.error || "Não foi possível consultar as turmas deste ano.");
        }
        return json;
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha na pesquisa.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [academicYearId, escolaParam, page, query, retry]);

  const rows = data?.ano_letivo_id === academicYearId ? (data.items ?? []) : [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section id="turmas-historicas" aria-label="Turmas e classes anteriores" className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sora text-base font-semibold text-klasse-green">Turmas de {yearLabel}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada turma mantém o currículo, a classe e os documentos do seu ano de origem.
          </p>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {total} {total === 1 ? "turma" : "turmas"}
          </span>
        )}
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">Pesquisar turma anterior pelo nome</span>
        <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          maxLength={80}
          value={q}
          onChange={(event) => { setQ(event.target.value); setPage(1); setExpandedTurmaId(null); }}
          placeholder="Pesquisar turma pelo nome"
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
        />
      </label>

      {loading && <p role="status" className="text-sm text-muted-foreground">A consultar turmas históricas…</p>}
      {!loading && error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive">
          {error}
          <button type="button" onClick={() => setRetry((v) => v + 1)} className="rounded-xl border border-border px-3 py-1.5 font-medium text-foreground">
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {query ? "Nenhuma turma corresponde à pesquisa neste ano." : "Não foram encontradas turmas neste ano letivo."}
        </p>
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border">
          {rows.map((turma) => (
            <div key={turma.id} className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <BookOpen className="h-4 w-4 text-klasse-green" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{turma.codigo || turma.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[turma.classe, turma.curso, turma.turno].filter(Boolean).join(" · ") || "Informações da turma"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-expanded={expandedTurmaId === turma.id}
                  onClick={() => setExpandedTurmaId((old) => old === turma.id ? null : turma.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-klasse-gold">
                  {expandedTurmaId === turma.id ? "Fechar histórico" : "Consultar histórico"}
                </button>
                <a
                  href={`/api/secretaria/turmas/${encodeURIComponent(turma.id)}/alunos/pdf?mode=ano_letivo`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-klasse-gold"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Lista PDF
                </a>
                <a
                  href={`/api/secretaria/turmas/${encodeURIComponent(turma.id)}/alunos/xlsx?mode=ano_letivo`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-klasse-gold"
                >
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Lista Excel
                </a>
                <Link
                  href={`${portalBase}/turmas/${encodeURIComponent(turma.id)}?ano_letivo_id=${encodeURIComponent(academicYearId)}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-klasse-gold"
                >
                  Ver turma <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </div>
              </div>
              {expandedTurmaId === turma.id && (
                <ArchiveTurmaRecordsPanel key={academicYearId + ":" + turma.id}
                  academicYearId={academicYearId} turmaId={turma.id} escolaParam={escolaParam} />
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && total > pageSize && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Página {page} de {pageCount}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 disabled:opacity-40">
              Seguinte <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

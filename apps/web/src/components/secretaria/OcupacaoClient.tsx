"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { useEscolaId } from "@/hooks/useEscolaId";
import { formatTurmaDisplayName } from "@/utils/formatters";
import {
  OperationalTableEmptyState,
  OperationalTableErrorState,
  OperationalTablePagination,
  OperationalTableSkeleton,
} from "@/components/ui/OperationalTableStates";

type OcupacaoRow = {
  id: string;
  nome: string | null;
  sala: string | null;
  capacidade_maxima: number | null;
  total_matriculas_ativas: number | null;
  ocupacao_percentual: number | null;
  status_ocupacao: string | null;
};
type GrupoOcupacao = {
  classe: string | null;
  turno: string | null;
  capacidade_total: number;
  matriculas_ativas_total: number;
  ocupacao_media: number;
  turmas: OcupacaoRow[];
};
type OccupancyResponse = {
  ok: true;
  total_turmas: number;
  resultados_na_pagina: number;
  pagina: number;
  tamanho_pagina: number;
  total_paginas: number;
  grupos_escopo: "pagina";
  grupos: GrupoOcupacao[];
  classes_disponiveis: string[];
};

const PAGE_SIZE = 25;
const filterClass = "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 sm:w-auto";
const occupancyColors: Record<string, string> = {
  superlotada: "border-destructive/30 bg-destructive/10 text-destructive",
  cheia: "border-amber-300 bg-amber-50 text-amber-900",
  ideal: "border-emerald-300 bg-emerald-50 text-emerald-900",
  disponivel: "border-border bg-muted text-muted-foreground",
};

export default function OcupacaoClient() {
  const { escolaId, isLoading: escolaLoading, error: escolaError } = useEscolaId();
  const [data, setData] = useState<OccupancyResponse | null>(null);
  const [loadedSchoolId, setLoadedSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classeFilter, setClasseFilter] = useState("");
  const [turnoFilter, setTurnoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const requestRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async () => {
    requestRef.current?.abort();
    if (!escolaId) {
      setData(null);
      setLoadedSchoolId(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        escola_id: escolaId,
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (classeFilter) params.set("classe", classeFilter);
      if (turnoFilter) params.set("turno", turnoFilter);
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(`/api/secretaria/turmas/ocupacao?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !Array.isArray(json.grupos) ||
          !Number.isFinite(json.total_turmas) || !Array.isArray(json.classes_disponiveis)) {
        throw new Error(json?.error || "Falha ao carregar dados de ocupação.");
      }
      if (controller.signal.aborted) return;

      if (json.total_turmas > 0 && page > json.total_paginas) {
        setPage(json.total_paginas);
        return;
      }
      setData(json as OccupancyResponse);
      setLoadedSchoolId(escolaId);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar a ocupação.");
      setLoadedSchoolId(escolaId);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [escolaId, page, classeFilter, turnoFilter, statusFilter]);

  useEffect(() => {
    void loadData();
    return () => { requestRef.current?.abort(); };
  }, [loadData]);

  // A school switch must not retain filter values or expose options from another school.
  useEffect(() => {
    setClasseFilter("");
    setTurnoFilter("");
    setStatusFilter("");
    setPage(1);
  }, [escolaId]);

  const classOptions = loadedSchoolId === escolaId ? (data?.classes_disponiveis ?? []) : [];
  const ready = !escolaLoading && !!escolaId && loadedSchoolId === escolaId && !loading;
  const displayError = escolaError || (!escolaLoading && !escolaId ? "Escola não identificada." : error);
  const safeData = ready && !displayError ? data : null;
  const clearFilters = () => {
    setClasseFilter("");
    setTurnoFilter("");
    setStatusFilter("");
    setPage(1);
  };

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-5`}>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-foreground">Filtros de ocupação</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            <span>Classe</span>
            <select aria-label="Filtrar por classe" value={classeFilter}
              onChange={(event) => { setClasseFilter(event.target.value); setPage(1); }}
              className={filterClass}>
              <option value="">Todas as classes</option>
              {classeFilter && !classOptions.includes(classeFilter) &&
                <option value={classeFilter}>{classeFilter}</option>}
              {classOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            <span>Turno</span>
            <select aria-label="Filtrar por turno" value={turnoFilter}
              onChange={(event) => { setTurnoFilter(event.target.value); setPage(1); }}
              className={filterClass}>
              <option value="">Todos os turnos</option>
              <option value="M">Manhã</option>
              <option value="T">Tarde</option>
              <option value="N">Noite</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            <span>Ocupação</span>
            <select aria-label="Filtrar por ocupação" value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
              className={filterClass}>
              <option value="">Todos os estados</option>
              <option value="disponivel">Disponível</option>
              <option value="ideal">Ideal</option>
              <option value="cheia">Cheia</option>
              <option value="superlotada">Superlotada</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={clearFilters}
              className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">
              Limpar filtros
            </button>
            <button type="button" onClick={() => void loadData()} disabled={loading || !escolaId}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50">
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {loading || escolaLoading || (!!escolaId && loadedSchoolId !== escolaId) ? (
        <OperationalTableSkeleton label="A carregar ocupação das turmas" columns={6} rows={5} />
      ) : displayError ? (
        <OperationalTableErrorState
          description={String(displayError)}
          onRetry={() => escolaId ? void loadData() : window.location.reload()}
        />
      ) : safeData ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p aria-live="polite" className="font-semibold text-foreground">
              {safeData.total_turmas} {safeData.total_turmas === 1 ? "turma encontrada" : "turmas encontradas"}
            </p>
            <p className="text-xs text-muted-foreground">
              Página {safeData.pagina} de {safeData.total_paginas} · {safeData.resultados_na_pagina} nesta página
            </p>
          </div>
          {safeData.total_turmas === 0 ? (
            <OperationalTableEmptyState
              title="Nenhuma turma corresponde aos filtros."
              description="Altere ou limpe os filtros para consultar outras turmas."
            />
          ) : (
            <>
              <div className="space-y-4">
                {safeData.grupos.map(group => (
                  <section key={JSON.stringify([group.classe, group.turno])}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-foreground">
                        {group.classe || "Classe não definida"} · {group.turno || "Sem turno"}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {group.turmas.length} turmas deste grupo nesta página
                      </span>
                    </div>
                    <div className="min-w-0 overflow-x-auto">
                      <table className="min-w-[720px] w-full divide-y divide-border text-left text-sm">
                        <caption className="sr-only">Ocupação das turmas desta página</caption>
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th scope="col" className="px-3 py-3 font-semibold">Turma</th>
                            <th scope="col" className="px-3 py-3 font-semibold">Sala</th>
                            <th scope="col" className="px-3 py-3 font-semibold">Capacidade</th>
                            <th scope="col" className="px-3 py-3 font-semibold">Matrículas ativas</th>
                            <th scope="col" className="px-3 py-3 font-semibold">Ocupação</th>
                            <th scope="col" className="px-3 py-3 font-semibold">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {group.turmas.map(turma => (
                            <tr key={turma.id} className="hover:bg-muted/40">
                              <td className="px-3 py-4 font-medium text-foreground">{formatTurmaDisplayName(turma)}</td>
                              <td className="px-3 py-4 text-muted-foreground">{turma.sala ?? "—"}</td>
                              <td className="px-3 py-4 text-muted-foreground">{turma.capacidade_maxima ?? "—"}</td>
                              <td className="px-3 py-4 text-muted-foreground">{turma.total_matriculas_ativas ?? "—"}</td>
                              <td className="px-3 py-4 text-muted-foreground">
                                {turma.ocupacao_percentual == null ? "—" : `${Number(turma.ocupacao_percentual).toFixed(1)}%`}
                              </td>
                              <td className="px-3 py-4">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${occupancyColors[turma.status_ocupacao ?? ""] ?? "border-border bg-muted text-muted-foreground"}`}>
                                  {turma.status_ocupacao ?? "Desconhecido"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
              <OperationalTablePagination
                page={safeData.pagina}
                pageSize={safeData.tamanho_pagina}
                total={safeData.total_turmas}
                disabled={loading}
                onPageChange={setPage}
              />
              <p className="text-xs text-muted-foreground">
                A contagem refere-se a todas as turmas correspondentes aos filtros. Os grupos e respetivas médias apresentam apenas a página atual.
              </p>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildContextualPortalHref } from "@/lib/navigation";
import { 
  Download, 
  UserPlus, 
  ArrowLeft,
  Users, 
  Mail, 
  Phone, 
  Briefcase,
  Calendar,
  Eye,
  Edit,
  IdCard
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "@/hooks/useDebounce";
import { OperationalTablePagination, OperationalTableFilterBar, OperationalTableEmptyState, OperationalTableErrorState } from "@/components/ui/OperationalTableStates";
import { Skeleton } from "@/components/feedback/FeedbackSystem";

type Professor = {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  created_at: string;
  profiles?: { numero_processo_login?: string | null } | Array<{ numero_processo_login?: string | null }>;
};

export default function ProfessoresListClient() {
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [days, setDays] = useState("30");
  const [cargoFilter, setCargoFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Professor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSequence = useRef(0);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const hasRows = !loading && items.length > 0;
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 88,
    overscan: 6,
  });

  const load = useCallback(async (p: number, signal: AbortSignal) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        q: debouncedQ, days, cargo: cargoFilter, page: String(p), pageSize: String(pageSize),
      });
      const res = await fetch(`/api/secretaria/professores?${params.toString()}`, { signal, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar professores");
      if (requestId !== requestSequence.current || signal.aborted) return;
      const safeTotal = Number.isFinite(json.total) ? Math.max(0, json.total) : 0;
      setItems(json.items ?? []);
      setTotal(safeTotal);
      const lastPage = Math.max(1, Math.ceil(safeTotal / pageSize));
      if (p > lastPage) setPage(lastPage);
    } catch (cause) {
      if (requestId !== requestSequence.current || signal.aborted) return;
      setFetchError(cause instanceof Error ? cause.message : "Falha ao carregar professores");
      setItems([]);
      setTotal(0);
    } finally {
      if (requestId === requestSequence.current && !signal.aborted) setLoading(false);
    }
  }, [cargoFilter, days, pageSize, debouncedQ]);

  useEffect(() => {
    // Do not query with an old search term while the user is still typing.
    if (q !== debouncedQ) return;
    const controller = new AbortController();
    void load(page, controller.signal);
    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [load, page, reloadKey, q, debouncedQ]);

  // Calcular métricas
  const professoresPorCargo = useMemo(() => {
    const cargos: Record<string, number> = {};
    items.forEach(prof => {
      const cargo = prof.cargo || 'professor';
      cargos[cargo] = (cargos[cargo] || 0) + 1;
    });
    return cargos;
  }, [items]);

  const professoresComEmail = useMemo(() => 
    items.filter(p => p.email).length, 
    [items]
  );

  const professoresComTelefone = useMemo(() => 
    items.filter(p => p.telefone).length, 
    [items]
  );

  const getCargoColor = (cargo: string | null) => {
    switch (cargo) {
      case 'diretor': return 'bg-muted text-foreground';
      case 'coordenador': return 'bg-muted text-foreground';
      case 'assistente': return 'bg-green-100 text-green-700';
      default: return 'bg-muted text-foreground';
    }
  };

  const getCargoIcon = (cargo: string | null) => {
    switch (cargo) {
      case 'diretor': return '👑';
      case 'coordenador': return '📋';
      case 'assistente': return '👨‍💼';
      default: return '👨‍🏫';
    }
  };

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-6 rounded-xl bg-muted`}>
      {/* --- BOTÃO VOLTAR --- */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted border border-border transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-navy">{total}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Total de Professores
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {Object.keys(professoresPorCargo).length}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Cargos nesta página
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {professoresComEmail}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Com E-mail (página)
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {professoresComTelefone}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Com Telefone (página)
          </div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-5 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted0" />
            Gestão de Professores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} professores cadastrados • {Object.keys(professoresPorCargo).length} cargos • {professoresComEmail} com e-mail
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="professores/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" />
            Novo Professor
          </Link>
        </div>
      </div>

      <OperationalTableFilterBar
        query={q}
        onQueryChange={(next) => { setQ(next); setPage(1); }}
        label="Pesquisar professores"
        placeholder="Pesquisar por nome, e-mail ou telefone…"
        activeFilters={Number(Boolean(q.trim())) + Number(days !== "30") + Number(Boolean(cargoFilter))}
        onClearFilters={() => { setQ(""); setDays("30"); setCargoFilter(""); setPage(1); }}
      >
        <div role="group" aria-label="Filtrar por período" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Período:</span>
          {['1', '7', '30', '90'].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => { setDays(d); setPage(1); }}
              className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${days === d ? "border-klasse-gold/50 bg-klasse-gold/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
            >
              {d === '1' ? '1 dia' : `${d} dias`}
            </button>
          ))}
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Cargo
          <select
            value={cargoFilter}
            onChange={(event) => { setCargoFilter(event.target.value); setPage(1); }}
            className="min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
          >
            <option value="">Todos os cargos</option>
            <option value="professor">Professor</option>
            <option value="diretor">Diretor</option>
            <option value="coordenador">Coordenador</option>
            <option value="assistente">Assistente</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => { setPage(1); setReloadKey((key) => key + 1); }}
          className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
        >
          Atualizar
        </button>
        <a
          href={`professores/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}&cargo=${encodeURIComponent(cargoFilter)}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
          target="_blank" rel="noreferrer"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV
        </a>
        <a
          href={`professores/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}&cargo=${encodeURIComponent(cargoFilter)}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
          target="_blank" rel="noreferrer"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Exportar JSON
        </a>
      </OperationalTableFilterBar>

      {/* --- TABELA DE PROFESSORES --- */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
          <table className="min-w-full table-fixed divide-y divide-border text-sm">
            <thead className="bg-muted sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Professor
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Contato
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Cargo
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Cadastrado em
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody
              className="divide-y divide-border"
              style={
                hasRows
                  ? {
                      position: "relative",
                      display: "block",
                      height: rowVirtualizer.getTotalSize(),
                    }
                  : undefined
              }
            >
              {loading ? (
                <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <div role="status" aria-busy="true" aria-label="A carregar professores" className="space-y-2">
                      <Skeleton className="h-4 w-40 mx-auto" />
                      <Skeleton className="h-3 w-56 mx-auto" />
                    </div>
                  </td>
                </tr>
              ) : fetchError ? (
                <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td colSpan={5} className="p-4">
                    <OperationalTableErrorState description={fetchError} onRetry={() => setReloadKey((key) => key + 1)} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td colSpan={5}>
                    <OperationalTableEmptyState
                      title="Nenhum professor encontrado"
                      description={q || cargoFilter ? "Ajuste a pesquisa ou os filtros." : "Comece por cadastrar o primeiro professor."}
                    />
                  </td>
                </tr>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const professor = items[virtualRow.index];
                  const numeroLogin = Array.isArray(professor.profiles)
                    ? (professor.profiles?.[0]?.numero_processo_login ?? null)
                    : (professor.profiles?.numero_processo_login ?? null);

                  return (
                    <tr
                      key={professor.user_id || professor.id}
                      className="hover:bg-muted transition-colors"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        transform: `translateY(${virtualRow.start}px)`,
                        width: "100%",
                        display: "table",
                        tableLayout: "fixed",
                      }}
                    >
                      <td className="px-4 py-4 text-foreground">
                        <div className="font-bold text-moxinexa-navy">
                          {professor.nome}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 mt-1">
                          {numeroLogin && (
                            <div className="flex items-center gap-1">
                              <IdCard className="h-3 w-3" />
                              <span className="font-mono bg-muted px-2 py-1 rounded">
                                {numeroLogin}
                              </span>
                            </div>
                          )}
                          <div className="font-mono text-muted-foreground">
                            {(professor.user_id || professor.id).slice(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {professor.email ? (
                            <div className="flex items-center gap-2 text-foreground">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {professor.email}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                          {professor.telefone ? (
                            <div className="flex items-center gap-2 text-foreground">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {professor.telefone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getCargoColor(professor.cargo)}`}>
                          {getCargoIcon(professor.cargo)} {professor.cargo || 'professor'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(professor.created_at).toLocaleDateString('pt-AO')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Link
                            href={buildContextualPortalHref(escolaParam, `/secretaria/professores/${professor.user_id || professor.id}`, pathname)}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-lg transition-all"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={escolaId ? `/escola/${escolaId}/professores?editar=${encodeURIComponent(professor.user_id || professor.id)}` : buildContextualPortalHref(escolaParam, `/secretaria/professores`, pathname)}
                            className="text-green-600 hover:text-white hover:bg-green-600 p-2 rounded-lg transition-all"
                            title="Editar professor"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <OperationalTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          disabled={loading || Boolean(fetchError)}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

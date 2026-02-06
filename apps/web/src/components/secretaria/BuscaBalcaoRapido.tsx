"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  CheckCircle,
  Search,
  X,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";

type AlunoResult = {
  id: string;
  aluno_id?: string | null;
  nome?: string | null;
  bi_numero?: string | null;
  telefone_responsavel?: string | null;
  numero_processo?: string | null;
  turma_atual?: string | null;
  total_em_atraso?: number | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

function statusBadge(totalEmAtraso?: number | null) {
  if (Number(totalEmAtraso ?? 0) > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Inadimplente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <CheckCircle className="h-3 w-3" />
      Regular
    </span>
  );
}

function OmniSearchInput({
  query,
  setQuery,
  results,
  loading,
  onSelect,
  open,
  setOpen,
  activeIndex,
  setActiveIndex,
  placeholder,
  size = "lg",
  autoFocus,
  inputRef,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: AlunoResult[];
  loading: boolean;
  onSelect: (aluno: AlunoResult) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  activeIndex: number;
  setActiveIndex: (value: number) => void;
  placeholder: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const sizeStyles =
    size === "lg"
      ? "text-base md:text-lg py-4"
      : "text-sm py-2.5";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(activeIndex + 1 >= results.length ? 0 : activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(activeIndex <= 0 ? results.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        onSelect(results[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={cx(
            "w-full rounded-xl border border-slate-200 bg-white pl-12 pr-10 font-medium text-slate-900",
            "focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20",
            sizeStyles
          )}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              setActiveIndex(-1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-sm">
          {results.map((aluno, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={aluno.aluno_id ?? aluno.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(aluno)}
                className={cx(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
                  "border-b border-slate-100 last:border-b-0",
                  isActive ? "bg-klasse-gold/10" : "hover:bg-slate-50"
                )}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">
                    {aluno.nome || "Aluno"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {aluno.numero_processo ? `Proc: ${aluno.numero_processo}` : "Sem processo"}
                    {aluno.bi_numero ? ` • BI ${aluno.bi_numero}` : ""}
                    {aluno.turma_atual ? ` • ${aluno.turma_atual}` : ""}
                  </div>
                </div>
                <div className="shrink-0">{statusBadge(aluno.total_em_atraso)}</div>
              </button>
            );
          })}
        </div>
      )}

      {open && query && results.length === 0 && !loading && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Nenhum estudante encontrado.
        </div>
      )}
    </div>
  );
}

export function BuscaBalcaoRapido({ escolaId }: { escolaId: string | null }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<AlunoResult[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoResult | null>(null);
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const debouncedQuery = useDebounce(query.trim(), 300);

  const idleInputRef = useRef<HTMLInputElement | null>(null);
  const headerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        if (active) {
          setResultados([]);
          setCarregando(false);
        }
        return;
      }

      setCarregando(true);
      try {
        const params = new URLSearchParams({
          search: debouncedQuery,
          limit: "8",
          status: "ativo",
          includeResumo: "1",
        });
        const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        const rows = (data.items || data.data || []) as AlunoResult[];
        if (active) setResultados(rows);
      } catch (error) {
        if (active) setResultados([]);
        console.error("Erro na busca:", error);
      } finally {
        if (active) setCarregando(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const results = useMemo(() => resultados.slice(0, 8), [resultados]);

  const handleSelect = (aluno: AlunoResult) => {
    setAlunoSelecionado(aluno);
    setWorkspaceVisible(true);
    requestAnimationFrame(() => setWorkspaceActive(true));
    setQuery("");
    setResultados([]);
    setMostrarResultados(false);
    setActiveIndex(-1);
    window.setTimeout(() => {
      headerInputRef.current?.focus();
    }, 0);
  };

  const handleCloseWorkspace = () => {
    setWorkspaceActive(false);
    window.setTimeout(() => {
      setWorkspaceVisible(false);
      setAlunoSelecionado(null);
    }, 200);
    setQuery("");
    setResultados([]);
    setActiveIndex(-1);
    window.setTimeout(() => {
      idleInputRef.current?.focus();
    }, 0);
  };

  const alunoSelecionadoId = alunoSelecionado?.aluno_id ?? alunoSelecionado?.id ?? null;

  return (
    <div className="relative">
      <div className="mx-auto w-full max-w-2xl">
        <OmniSearchInput
          query={query}
          setQuery={setQuery}
          results={results}
          loading={carregando}
          onSelect={handleSelect}
          open={mostrarResultados}
          setOpen={setMostrarResultados}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          placeholder="Digite o nome, nº de processo ou BI do estudante..."
          size="lg"
          autoFocus
          inputRef={idleInputRef}
        />
      </div>

      {mostrarResultados && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setMostrarResultados(false)}
        />
      )}

      {workspaceVisible && alunoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div
            className={cx(
              "pointer-events-none absolute inset-0 transition-opacity duration-200",
              workspaceActive ? "opacity-100" : "opacity-0"
            )}
            onClick={handleCloseWorkspace}
          />
          <div
            className={cx(
              "relative flex w-full max-w-6xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl",
              "transition-all duration-200 ease-out",
              workspaceActive ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.98]"
            )}
          >
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
                <div className="flex-1">
                  <OmniSearchInput
                    query={query}
                    setQuery={setQuery}
                    results={results}
                    loading={carregando}
                    onSelect={handleSelect}
                    open={mostrarResultados}
                    setOpen={setMostrarResultados}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    placeholder="Trocar estudante..."
                    size="md"
                    inputRef={headerInputRef}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCloseWorkspace}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-8">
              <div className="mx-auto w-full max-w-6xl space-y-6">
                {escolaId && alunoSelecionadoId ? (
                  <BalcaoAtendimento
                    escolaId={escolaId}
                    selectedAlunoId={alunoSelecionadoId}
                    showSearch={false}
                    embedded
                  />
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                    Escola não identificada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

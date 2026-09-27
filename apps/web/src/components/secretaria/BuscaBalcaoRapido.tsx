"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";
import { OmniSearchInput } from "@/components/secretaria/OmniSearchInput";

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
        const params = new URLSearchParams({ query: debouncedQuery });
        const res = await fetch(`/api/secretaria/balcao/alunos/search?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        const rows = (data.alunos || []) as AlunoResult[];
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

  const results = useMemo(() => resultados.slice(0, 20), [resultados]);

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
          placeholder="Digite o nome, processo ou BI do aluno..."
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
              "relative flex w-[88vw] max-w-[1280px] h-[84vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl",
              "transition-all duration-200 ease-out",
              workspaceActive ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.98]"
            )}
          >
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur flex-shrink-0">
              <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4">
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
                    placeholder="Trocar aluno..."
                    size="md"
                    inputRef={headerInputRef}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCloseWorkspace}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="mx-auto w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-full">
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

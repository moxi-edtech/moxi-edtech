"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { BalcaoWorkspace } from "@/components/secretaria/BalcaoWorkspace";
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

export function BuscaBalcaoRapido({ escolaId }: { escolaId: string | null }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<AlunoResult[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoResult | null>(null);
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  const debouncedQuery = useDebounce(query.trim(), 300);
  const idleInputRef = useRef<HTMLInputElement | null>(null);

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

    void load();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const results = useMemo(() => resultados.slice(0, 20), [resultados]);

  const handleSelect = (aluno: AlunoResult) => {
    setAlunoSelecionado(aluno);
    setWorkspaceVisible(true);
    setQuery("");
    setResultados([]);
    setMostrarResultados(false);
    setActiveIndex(-1);
  };

  const handleCloseWorkspace = () => {
    setWorkspaceVisible(false);
    setAlunoSelecionado(null);
    setQuery("");
    setResultados([]);
    setActiveIndex(-1);
    window.setTimeout(() => idleInputRef.current?.focus(), 0);
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

      {workspaceVisible && escolaId && alunoSelecionadoId && alunoSelecionado ? (
        <BalcaoWorkspace
          open
          escolaId={escolaId}
          aluno={{
            id: alunoSelecionadoId,
            label: alunoSelecionado.nome || "Aluno",
          }}
          actionId="desk"
          onClose={handleCloseWorkspace}
        />
      ) : null}
    </div>
  );
}

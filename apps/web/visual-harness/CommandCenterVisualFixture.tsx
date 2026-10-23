import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TurmaContextView } from "../src/components/secretaria/command-center/TurmaContextView";
import type { ExplorerViewState } from "../src/lib/command-center/explorer-return-context";
import type { EntityContext } from "../src/lib/command-center/entity-context";

const SCHOOL_ID = "00000000-0000-4000-8000-0000000000a1";
const YEAR_ID = "00000000-0000-4000-8000-000000000026";
const TURMA_ID = "00000000-0000-4000-8000-0000000000f1";
const CLASS_ID = "00000000-0000-4000-8000-0000000000c1";
const students = Array.from({ length: 55 }, (_, i) => ({
  id: `00000000-0000-4000-8100-${String(i + 1).padStart(12, "0")}`,
  nome: `Aluno Sintético ${String(i + 1).padStart(2, "0")}`,
  numeroChamada: i + 1,
  turmaId: TURMA_ID,
  turmaNome: "10.ª A",
  numero: `2026/${String(i + 1).padStart(4, "0")}`,
  documentosSinalizados: [1,4].includes(i+1),
  propinasVencidas: [2,4].includes(i+1),
  pendenciasCount: (Number([1,4].includes(i+1)) + Number([2,4].includes(i+1))),
}));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Intercepts real explorer HTTP endpoints before any React component mounts. */
export function installCommandCenterVisualMocks() {
  const oldFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const raw = String(input);
    if (!raw.includes("/command-center/")) return oldFetch(input, init);
    const url = new URL(raw, location.origin);
    const metrics = window as Window & { __ccSyntheticRequestCount?: number };
    metrics.__ccSyntheticRequestCount = (metrics.__ccSyntheticRequestCount ?? 0) + 1;
    if (!url.pathname.includes(SCHOOL_ID)) return Promise.resolve(json({ ok: false, error: "Sem acesso." }, 403));
    if (url.pathname.includes("/student-capabilities")) return Promise.resolve(json({
      ok: true, actions: {
        enrollment: true, reenrollment: true, payment: true,
        document: true, profile: true, grade: true,
      },
    }));
    if (url.pathname.includes("/roster/export")) return Promise.resolve(json({
      ok: false, error: "Exportação não autorizada nesta escola sintética.",
    },403));
    if (url.pathname.includes("/roster")) {
      const q = (url.searchParams.get("q") ?? "").toLocaleLowerCase("pt");
      if (q === "demora") {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Interrompido", "AbortError")), { once: true });
        });
      }
      if (q === "erro") return Promise.resolve(json({ ok: false, error: "Falha sintética" }, 503));
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const filter = url.searchParams.get("filter") ?? "todos";
      const results = students.filter((student) =>
        normalize(`${student.nome} ${student.numero}`).includes(normalize(q)) &&
        (filter === "todos" ||
         (filter === "documentos_sinalizados" && student.documentosSinalizados) ||
         (filter === "propinas_vencidas" && student.propinasVencidas) ||
         (filter === "ambos" && student.documentosSinalizados && student.propinasVencidas)));;
      const sort = url.searchParams.get("sort");
      const ordered = sort === "nome_desc" ? [...results].reverse()
        : sort === "pendencias_primeiro"
          ? [...results].sort((a,b) => b.pendenciasCount-a.pendenciasCount || a.nome.localeCompare(b.nome))
          : results;
      const index = url.searchParams.has("cursorId")
        ? ordered.findIndex((s) => s.id === url.searchParams.get("cursorId")) + 1 : 0;
      const page = ordered.slice(index, index + 20);
      return Promise.resolve(json({ ok: true,
        items: page, total: results.length, size: 20,
        hasMore: index + page.length < results.length,
        cursor: page.length ? {
          id: page[page.length - 1].id,
          name: normalize(page[page.length - 1].nome),
          priority: page[page.length - 1].pendenciasCount,
        } : null,
      }));
    }
    if (url.pathname.includes("/turmas/")) {
      const page = Number(url.searchParams.get("page") || "1");
      return Promise.resolve(json({ ok: true, data: {
        turma: {
          id: TURMA_ID, nome: "10.ª A", turno: "Manhã", sala: "Sala 03",
          classe: { id: CLASS_ID, nome: "10.ª Classe" },
          curso: { id: "00000000-0000-4000-8000-0000000000e1", nome: "Ensino Geral" },
          capacidade: 50, anoLetivo: { id: YEAR_ID, ano: 2026, historico: false },
        },
        alunos: {
          items: students.slice((page - 1) * 20, page * 20),
          total: 55, page, pageSize: 20, hasMore: page * 20 < 55,
        },
        disciplinas: [], professores: [], professoresDetalhes: [], disciplinasLimitadas: false,
      } }));
    }
    return Promise.resolve(json({ ok: false, error: "Rota não simulada." }, 404));
  };
}

const context: EntityContext = {
  id: TURMA_ID, type: "turma", escolaId: SCHOOL_ID,
  label: "10.ª A", academicYearId: YEAR_ID,
};

export default function CommandCenterVisualFixture() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  }));
  useEffect(() => {
    const bridge = window as Window & {
      __ccQueryMetrics?: () => { queryCount: number; viewCount: number };
    };
    bridge.__ccQueryMetrics = () => ({
      queryCount: queryClient.getQueryCache().getAll().length,
      viewCount: 1,
    });
    return () => { delete bridge.__ccQueryMetrics; };
  }, [queryClient]);
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const [view, setView] = useState<ExplorerViewState>({
    page: 1, scrollTop: 0, selectedStudentId: null, search: "", filter: "todos", sort: "nome_asc",
  });
  const [returned, setReturned] = useState(false);
  // Synthetic viewport matches the Command Palette's single scroll owner.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  return <main className="mx-auto min-h-screen w-full max-w-5xl overflow-x-clip bg-slate-50 px-3 py-5 text-slate-900 sm:px-5">
    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">KLASSE · DADOS SINTÉTICOS · NÃO É PRODUÇÃO</p>
    <h1 className="mb-3 text-lg font-semibold">Command Center · Secretaria</h1>
    <QueryClientProvider client={queryClient}>
      {selected ? (
        <div role="dialog" aria-modal="true" aria-label="Balcão sintético"
          className="mx-auto mt-6 max-w-lg rounded-xl border border-emerald-200 bg-white p-5 shadow-lg">
          <h2 className="font-semibold">Balcão de atendimento · fixture</h2>
          <p className="mt-2 text-sm">Aluno seleccionado: {selected.label}</p>
          <p className="mt-2 text-xs text-slate-500">Esta é apenas uma simulação de retorno, sem operações académicas ou financeiras.</p>
          <button type="button" onClick={() => { setSelected(null); setReturned(true); }}
            className="mt-5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
            Voltar à turma
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          {returned && <p role="status" className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs">
            Voltou ao mesmo contexto da Turma — fixture de interface.
          </p>}
          <div ref={scrollContainerRef} role="region" aria-label="Área de rolagem da turma"
            onScroll={(event) => {
              const top = event.currentTarget.scrollTop;
              setView((previous) => previous.scrollTop === top
                ? previous : { ...previous, scrollTop: top });
            }}
            className="h-[min(70dvh,640px)] min-h-64 overflow-y-auto overscroll-contain">
          <TurmaContextView scrollContainerRef={scrollContainerRef} context={context} portal="secretaria"
            initialPage={view.page} initialScrollTop={view.scrollTop}
            selectedStudentId={view.selectedStudentId} initialSearch={view.search}
            initialFilter={view.filter === "documentos_sinalizados" ? "documentos_sinalizados" : view.filter === "propinas_vencidas" ? "propinas_vencidas" : "todos"}
            initialSort={view.sort === "pendencias_primeiro" ? "pendencias_primeiro" : view.sort === "nome_desc" ? "nome_desc" : "nome_asc"}
            onViewChange={setView} onStudentSelect={setSelected}
            onStudentAction={(_action, student) => setSelected(student)}
            onNavigate={() => undefined} onExploreClasse={() => undefined}
            onExploreProfessor={() => undefined} onExploreDisciplina={() => undefined} />
          </div>
        </div>
      )}
    </QueryClientProvider>
  </main>;
}

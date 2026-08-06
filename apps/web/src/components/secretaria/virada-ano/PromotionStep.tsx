"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Settings2,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/Button";

type StudentInfo = {
    id: string;
    nome: string;
    turma: string;
    classe: string;
    saldo: number;
};

type PromotionSummary = {
  total: number;
  counts: {
    aptos: number;
    inadimplentes: number;
    retidos: number;
  };
  lists: {
    aptos: StudentInfo[];
    aptos_ids?: string[];
    inadimplentes: StudentInfo[];
    retidos: StudentInfo[];
  };
};

type ReviewStudent = {
  matricula_id: string;
  aluno_id: string;
  nome: string;
  turma_id: string | null;
  numero_matricula: string | number | null;
  status: string | null;
};

type ReviewTurma = {
  id: string;
  nome: string;
  turno: string | null;
  classe_nome: string | null;
  capacidade_maxima: number | null;
  ocupacao_atual: number;
};

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function PromotionStep({ onComplete, fromSession, toSession }: { onComplete: () => void; fromSession: string; toSession: string }) {
  const [summary, setSummary] = useState<PromotionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tolerance, setTolerance] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promotingBatch, setPromotingBatch] = useState(false);
  const [reviewStudents, setReviewStudents] = useState<ReviewStudent[]>([]);
  const [reviewTurmas, setReviewTurmas] = useState<ReviewTurma[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reclassifyingId, setReclassifyingId] = useState<string | null>(null);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchSummary = async (tol: number) => {
    setLoading(true);
    try {
        const params = new URLSearchParams({ tolerance: String(tol) });
        if (fromSession) params.set("from_session_id", fromSession);
        const res = await fetch(`/api/secretaria/operacoes-academicas/virada/promotion-summary?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (json.ok) setSummary(json.summary);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(tolerance);
  }, [tolerance, fromSession]);

  const fetchReviewList = useCallback(async () => {
    if (!toSession) return;
    setReviewLoading(true);
    setReviewError(null);
    try {
      const response = await fetch(`/api/secretaria/operacoes-academicas/virada/review-list?to_session_id=${encodeURIComponent(toSession)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível carregar a revisão.");
      setReviewStudents(json.students ?? []);
      setReviewTurmas(json.turmas ?? []);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Não foi possível carregar a revisão.");
    } finally {
      setReviewLoading(false);
    }
  }, [toSession]);

  useEffect(() => {
    void fetchReviewList();
  }, [fetchReviewList]);

  const reclassifyStudent = async (student: ReviewStudent, turmaDestinoId: string) => {
    if (!turmaDestinoId || turmaDestinoId === student.turma_id) return;
    setReclassifyingId(student.matricula_id);
    setReviewError(null);
    try {
      const response = await fetch("/api/secretaria/operacoes-academicas/virada/reclassify-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: student.matricula_id,
          turma_destino_id: turmaDestinoId,
          motivo: "Revisão de classe após virada sem fricção",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível reclassificar o aluno.");
      await fetchReviewList();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Não foi possível reclassificar o aluno.");
    } finally {
      setReclassifyingId(null);
    }
  };

  const promoteStudent = async (studentId: string) => {
    setPromotingId(studentId);
    try {
      const response = await fetch("/api/secretaria/operacoes-academicas/virada/promote-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aluno_id: studentId, from_session_id: fromSession, to_session_id: toSession }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível promover o aluno.");
      await fetchSummary(tolerance);
      onComplete();
    } finally {
      setPromotingId(null);
    }
  };

  const promoteAptosBatch = async () => {
    const alunoIds = summary?.lists.aptos_ids ?? [];
    if (!fromSession || !toSession || alunoIds.length === 0) return;
    setPromotingBatch(true);
    try {
      const response = await fetch("/api/secretaria/operacoes-academicas/virada/promote-students-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aluno_ids: alunoIds, from_session_id: fromSession, to_session_id: toSession }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível promover o lote.");
      await fetchSummary(tolerance);
      onComplete();
    } finally {
      setPromotingBatch(false);
    }
  };

  const filteredLists = useMemo(() => {
      if (!summary) return null;
      const filter = (list: StudentInfo[]) => 
          list.filter(s => s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || s.turma.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return {
          aptos: filter(summary.lists.aptos),
          inadimplentes: filter(summary.lists.inadimplentes),
          retidos: filter(summary.lists.retidos)
      };
  }, [summary, searchTerm]);

  if (loading && !summary) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-slate-300" /></div>;

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2">
      
      {/* 1. Configuração de Tolerância */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-none">Tolerância Financeira</h3>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">Amnistia automática para virada</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <span className="pl-3 text-xs font-bold text-slate-500">AOA</span>
                  <input 
                    type="number"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-24 h-9 rounded-lg border-none bg-transparent px-2 text-sm font-black text-slate-800 outline-none focus:ring-0"
                    placeholder="0"
                  />
                  <Button size="sm" tone="gray" variant="ghost" onClick={() => fetchSummary(tolerance)}>Aplicar</Button>
              </div>
          </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase">Migração provisória</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{summary?.counts.aptos}</div>
          <p className="text-[10px] text-slate-400 mt-1">Notas serão revistas depois da virada.</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Bloqueados (Dívida)</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{summary?.counts.inadimplentes}</div>
          <p className="text-[10px] text-slate-400 mt-1">Rematrícula travada no Ledger.</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-rose-600 mb-2">
            <XCircle className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Revisão posterior</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{summary?.counts.retidos}</div>
          <p className="text-[10px] text-slate-400 mt-1">A classe será confirmada pela secretaria.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-emerald-900">Migrar alunos provisoriamente</h3>
          <p className="mt-1 text-xs text-emerald-700">A migração não exige notas lançadas; a secretaria confirma a classe de cada aluno depois.</p>
        </div>
        <Button
          size="sm"
          tone="gold"
          loading={promotingBatch}
          disabled={promotingBatch || promotingId !== null || !summary?.lists.aptos_ids?.length}
          onClick={() => void promoteAptosBatch()}
        >
          Migrar todos ({summary?.counts.aptos ?? 0})
        </Button>
      </div>

      {/* 2. Filtro de Busca */}
      <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <input 
            type="text"
            placeholder="Procurar aluno ou turma na simulação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-klasse-gold/10 transition-all"
          />
      </div>

      {/* 3. Listas Detalhadas */}
      <div className="space-y-3">
          {/* Inadimplentes */}
          <div className={`rounded-2xl border transition-all ${expanded === 'inadimplentes' ? 'border-amber-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
              <button 
                onClick={() => setExpanded(expanded === 'inadimplentes' ? null : 'inadimplentes')}
                className="w-full px-5 py-4 flex items-center justify-between"
              >
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600"><AlertCircle className="h-4 w-4" /></div>
                      <span className="text-sm font-bold text-slate-700">Ver Alunos com Dívida ({summary?.counts.inadimplentes})</span>
                  </div>
                  {expanded === 'inadimplentes' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              
              {expanded === 'inadimplentes' && (
                  <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {filteredLists?.inadimplentes.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                  <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-800">{s.nome}</span>
                                      <span className="text-[10px] text-slate-400">{s.classe} · {s.turma}</span>
                                  </div>
                                  <span className="text-xs font-black text-rose-600">{money.format(s.saldo)}</span>
                                  <Button
                                    size="sm"
                                    tone="gold"
                                    loading={promotingId === s.id}
                                    disabled={promotingId !== null}
                                    onClick={() => void promoteStudent(s.id)}
                                  >
                                    Promover após pagamento
                                  </Button>
                              </div>
                          ))}
                          {filteredLists?.inadimplentes.length === 0 && <p className="text-center py-4 text-xs text-slate-400">Nenhum aluno encontrado nesta categoria.</p>}
                      </div>
                  </div>
              )}
          </div>

          {/* Retidos */}
          <div className={`rounded-2xl border transition-all ${expanded === 'retidos' ? 'border-rose-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
              <button 
                onClick={() => setExpanded(expanded === 'retidos' ? null : 'retidos')}
                className="w-full px-5 py-4 flex items-center justify-between"
              >
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600"><XCircle className="h-4 w-4" /></div>
                      <span className="text-sm font-bold text-slate-700">Ver Alunos Reprovados ({summary?.counts.retidos})</span>
                  </div>
                  {expanded === 'retidos' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              
              {expanded === 'retidos' && (
                  <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {filteredLists?.retidos.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                  <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-800">{s.nome}</span>
                                      <span className="text-[10px] text-slate-400">{s.classe} · {s.turma}</span>
                                  </div>
                                  <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Reprovado</span>
                              </div>
                          ))}
                          {filteredLists?.retidos.length === 0 && <p className="text-center py-4 text-xs text-slate-400">Nenhum aluno encontrado nesta categoria.</p>}
                      </div>
                  </div>
              )}
          </div>
      </div>

      <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-violet-950">Revisão de classe após a virada</h3>
            <p className="mt-1 max-w-2xl text-xs text-violet-800">
              Depois da migração, confirme a turma efetiva de cada aluno. A matrícula e o número permanente permanecem os mesmos.
            </p>
          </div>
          <Button size="sm" tone="gray" variant="ghost" loading={reviewLoading} onClick={() => void fetchReviewList()}>
            Atualizar lista
          </Button>
        </div>
        {reviewError && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{reviewError}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Search className="h-4 w-4 text-violet-300" />
          <input
            type="search"
            value={reviewSearch}
            onChange={(event) => setReviewSearch(event.target.value)}
            placeholder="Pesquisar aluno na revisão..."
            className="h-9 flex-1 rounded-lg border border-violet-100 bg-white px-3 text-xs outline-none focus:ring-2 focus:ring-violet-200"
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">{reviewStudents.length} migrados</span>
        </div>
        {reviewLoading && reviewStudents.length === 0 ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-violet-400" /></div>
        ) : reviewStudents.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-violet-200 bg-white/70 px-3 py-4 text-center text-xs text-violet-700">
            Ainda não há matrículas no ano destino. Execute a migração provisória para abrir esta revisão.
          </p>
        ) : (
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
            {reviewStudents
              .filter((student) => student.nome.toLowerCase().includes(reviewSearch.toLowerCase()))
              .map((student) => (
                <div key={student.matricula_id} className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{student.nome}</p>
                    <p className="text-[10px] text-slate-400">Matrícula {student.numero_matricula ?? "—"} · {student.status ?? "ativa"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={student.turma_id ?? ""}
                      disabled={reclassifyingId !== null}
                      onChange={(event) => void reclassifyStudent(student, event.target.value)}
                      className="h-9 min-w-56 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 disabled:opacity-60"
                    >
                      <option value="">Sem turma destino</option>
                      {reviewTurmas.map((turma) => (
                        <option key={turma.id} value={turma.id}>
                          {turma.nome}{turma.classe_nome ? ` · ${turma.classe_nome}` : ""} · {turma.ocupacao_atual}/{turma.capacidade_maxima ?? "∞"}
                        </option>
                      ))}
                    </select>
                    {reclassifyingId === student.matricula_id && <Loader2 className="h-4 w-4 animate-spin text-violet-500" />}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex gap-3 shadow-sm">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed font-medium">
              Esta simulação utiliza o estado atual do <strong>Ledger Financeiro</strong> e o <strong>Histórico de Notas</strong>. 
              Ao avançar, os alunos bloqueados não serão transportados para o novo ano, permanecendo em estado de &quot;pendência&quot; na secretaria.
          </p>
      </div>

    </div>
  );
}

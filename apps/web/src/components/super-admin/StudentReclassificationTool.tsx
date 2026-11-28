"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, Search, ShieldCheck } from "lucide-react";

type StudentItem = {
  matricula_id: string;
  aluno_id: string;
  nome: string;
  numero_processo: string | null;
  encarregado_telefone: string | null;
  escola_id: string | null;
  escola_nome: string;
  turma_id: string | null;
  turma_nome: string;
  ano_letivo: number | string | null;
  status: string | null;
};

type TurmaItem = {
  id: string;
  nome: string;
  turno: string | null;
  capacidade_maxima: number | null;
  curso_id: string | null;
  classe_id: string | null;
  ano_letivo: number | string | null;
};

type RpcResult = {
  valor_novo?: number | string | null;
  turma_destino_nome?: string | null;
  matriculas_atualizadas?: number;
  mensalidades_turma_atualizadas?: number;
  mensalidades_abertas_reprecificadas?: number;
  mensalidades_pagas_reprecificadas?: number;
  pagamentos_reprecificados?: number;
  lancamentos_reprecificados?: number;
};

function formatMoney(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

export default function StudentReclassificationTool() {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [targetTurmaId, setTargetTurmaId] = useState("");
  const [reprecificarAbertas, setReprecificarAbertas] = useState(true);
  const [reprecificarPagas, setReprecificarPagas] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RpcResult | null>(null);

  const selectedTarget = useMemo(
    () => turmas.find((turma) => turma.id === targetTurmaId) ?? null,
    [targetTurmaId, turmas],
  );

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setStudents([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/super-admin/alunos/reclassificar?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Erro ao pesquisar aluno");
        setStudents(payload.students ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (!selectedStudent?.escola_id) {
      setTurmas([]);
      setTargetTurmaId("");
      return;
    }

    const student = selectedStudent;
    const controller = new AbortController();
    async function loadTurmas() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          escolaId: student.escola_id ?? "",
          anoLetivo: String(student.ano_letivo ?? ""),
        });
        const response = await fetch(`/api/super-admin/alunos/reclassificar?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Erro ao carregar turmas");
        const availableTurmas = (payload.turmas ?? []).filter((turma: TurmaItem) => turma.id !== student.turma_id);
        setTurmas(availableTurmas);
        setTargetTurmaId("");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadTurmas();
    return () => controller.abort();
  }, [selectedStudent]);

  async function submit() {
    if (!selectedStudent || !targetTurmaId) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/super-admin/alunos/reclassificar", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matriculaId: selectedStudent.matricula_id,
          turmaDestinoId: targetTurmaId,
          reprecificarAbertas,
          reprecificarPagas,
          motivo,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Erro ao reclassificar aluno");
      setResult(payload.result ?? null);
      setSelectedStudent((current) => current ? { ...current, turma_id: targetTurmaId, turma_nome: selectedTarget?.nome ?? current.turma_nome } : current);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = Boolean(selectedStudent && targetTurmaId && motivo.trim().length >= 8 && !isSubmitting);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="flex-1">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Aluno</span>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, número de processo ou parte do nome"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
              />
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </label>
        </div>

        {students.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {students.map((student) => {
              const active = selectedStudent?.matricula_id === student.matricula_id;
              return (
                <button
                  key={student.matricula_id}
                  type="button"
                  onClick={() => {
                    setSelectedStudent(student);
                    setResult(null);
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    active ? "border-emerald bg-emerald-50 dark:bg-emerald-950/30" : "border-border bg-card hover:border-ring"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-foreground">{student.nome}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{student.escola_nome}</p>
                    </div>
                    {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald" />}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Turma: <strong>{student.turma_nome}</strong></span>
                    <span>Ano: <strong>{student.ano_letivo ?? "-"}</strong></span>
                    <span>Estado: <strong>{student.status ?? "-"}</strong></span>
                    <span>Processo: <strong>{student.numero_processo ?? "-"}</strong></span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedStudent && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Reclassificação</h2>
                <p className="text-sm text-muted-foreground">{selectedStudent.turma_nome} para nova turma</p>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Turma destino</span>
              <select
                value={targetTurmaId}
                onChange={(event) => setTargetTurmaId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              >
                <option value="">Selecionar turma</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome}{turma.turno ? ` - ${turma.turno}` : ""}{turma.capacidade_maxima ? ` (${turma.capacidade_maxima})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4">
                <input
                  type="checkbox"
                  checked={reprecificarAbertas}
                  onChange={(event) => setReprecificarAbertas(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border text-emerald"
                />
                <span>
                  <span className="block text-sm font-black text-foreground">Atualizar meses abertos</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">Pendente, parcial ou isento sem pagamento.</span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4">
                <input
                  type="checkbox"
                  checked={reprecificarPagas}
                  onChange={(event) => setReprecificarPagas(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600"
                />
                <span>
                  <span className="block text-sm font-black text-rose-950 dark:text-rose-100">Atualizar meses pagos</span>
                  <span className="block text-xs leading-relaxed text-rose-700 dark:text-rose-300">Altera mensalidades pagas e pagamentos vinculados.</span>
                </span>
              </label>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Motivo</span>
              <textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                rows={3}
                placeholder="Ex.: correção de matrícula para classe de exame"
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              />
            </label>

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm font-semibold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Executar reclassificação
            </button>
          </div>

          <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Resumo</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Origem</p>
                <p className="font-black text-foreground">{selectedStudent.turma_nome}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Destino</p>
                <p className="font-black text-foreground">{selectedTarget?.nome ?? "Selecione uma turma"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Aluno</p>
                <p className="font-black text-foreground">{selectedStudent.nome}</p>
                <p className="text-xs text-muted-foreground">{selectedStudent.escola_nome}</p>
              </div>
            </div>

            {result && (
              <div className="mt-6 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Concluído
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-emerald-700 dark:text-emerald-300">Propina nova</dt>
                    <dd className="font-black text-emerald-950 dark:text-emerald-100">{formatMoney(result.valor_novo)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-emerald-700 dark:text-emerald-300">Mensalidades movidas</dt>
                    <dd className="font-black text-emerald-950 dark:text-emerald-100">{result.mensalidades_turma_atualizadas ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-emerald-700 dark:text-emerald-300">Abertas reprecificadas</dt>
                    <dd className="font-black text-emerald-950 dark:text-emerald-100">{result.mensalidades_abertas_reprecificadas ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-emerald-700 dark:text-emerald-300">Pagas reprecificadas</dt>
                    <dd className="font-black text-emerald-950 dark:text-emerald-100">{result.mensalidades_pagas_reprecificadas ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-emerald-700 dark:text-emerald-300">Pagamentos alterados</dt>
                    <dd className="font-black text-emerald-950 dark:text-emerald-100">{result.pagamentos_reprecificados ?? 0}</dd>
                  </div>
                </dl>
              </div>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}

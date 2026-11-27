"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { currentGradePeriod, type GradePeriodRow } from "@/lib/academico/grade-period-context";

type Subject = { id: string; nome: string | null };
type Grade = { aluno_id: string; matricula_id: string; mac?: number | null; npp?: number | null; npt?: number | null; mt?: number | null };

export function ProfessorStudentGrades({ turmaId, academicYearId, studentId, matriculaId, subjects }: {
  turmaId: string; academicYearId?: string; studentId: string; matriculaId: string; subjects: Subject[];
}) {
  const read = usePortalDrawerNavigation()?.read;
  const [subject, setSubject] = useState(subjects[0]?.id ?? "");
  const [period, setPeriod] = useState<number | null>(null);
  const [periods, setPeriods] = useState<number[]>([]);
  const [periodError, setPeriodError] = useState(false);
  const [periodReady, setPeriodReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ scope: string; row: Grade | null; components: string[]; maximum: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scope = JSON.stringify([turmaId, academicYearId, studentId, matriculaId, subject, period]);
  const selectedSubject = subjects.find(item => item.id === subject);
  useEffect(() => {
    const ctrl = new AbortController();
    setPeriodReady(false); setPeriodError(false); setPeriods([]); setPeriod(null);
    const params = new URLSearchParams({ turma_id: turmaId });
    if (academicYearId) params.set("ano_letivo_id", academicYearId);
    void (async () => {
      try {
        const response = await (read ? read(`/api/professor/periodos?${params}`, { signal: ctrl.signal, fresh: retry > 0 }) : fetch(`/api/professor/periodos?${params}`, { cache: "no-store", signal: ctrl.signal }));
        const body = await response.json();
        if (!response.ok || !body?.ok || !Array.isArray(body.items)) throw new Error("Períodos indisponíveis.");
        if (ctrl.signal.aborted) return;
        const items = body.items as GradePeriodRow[];
        const numbers = Array.from(new Set(items.map(item => Number(item.numero)).filter(n => [1, 2, 3].includes(n)))).sort((a,b) => a-b);
        setPeriods(numbers);
        const current = currentGradePeriod(items);
        setPeriod(current && numbers.includes(current) ? current : numbers[0] ?? null);
        setPeriodReady(true);
      } catch { if (!ctrl.signal.aborted) setPeriodError(true); }
    })();
    return () => ctrl.abort();
  }, [turmaId, academicYearId, retry, read]);
  useEffect(() => {
    setResult(null); setError(null);
    if (!periodReady || period === null || !subject || !selectedSubject) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({ turmaId, disciplinaId: subject, detalhado: "1", trimestre: String(period) });
    if (academicYearId) params.set("ano_letivo_id", academicYearId);
    void (async () => {
      try {
        const response = await fetch(`/api/professor/pauta?${params}`, { cache: "no-store", signal: ctrl.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body)) throw new Error("Não foi possível consultar as notas nesta disciplina.");
        if (ctrl.signal.aborted) return;
        const row = (body as Grade[]).find(item => item.aluno_id === studentId && item.matricula_id === matriculaId) ?? null;
        const max = Number(response.headers.get("x-klasse-grade-max"));
        const components = (response.headers.get("x-klasse-grade-components") ?? "").split(",").map(item => item.trim().toUpperCase()).filter(Boolean);
        setResult({ scope, row, components, maximum: Number.isFinite(max) && max > 0 ? max : null });
      } catch (cause) { if (!ctrl.signal.aborted) setError(cause instanceof Error ? cause.message : "Consulta indisponível."); }
    })();
    return () => ctrl.abort();
  }, [scope, turmaId, academicYearId, studentId, matriculaId, subject, period, periodReady, selectedSubject, retry]);
  const data = result?.scope === scope ? result : null;
  const columns = useMemo(() => data?.row ? [
    { label: "MAC", value: data.row.mac, active: data.components.length === 0 || data.components.includes("MAC") },
    { label: "NPP", value: data.row.npp, active: data.components.includes("NPP") },
    { label: "NPT", value: data.row.npt, active: data.components.length === 0 || data.components.includes("NPT") || data.components.includes("PT") },
    { label: "Média trimestral", value: data.row.mt, active: true },
  ].filter(item => item.active) : [], [data]);
  return <div className="min-w-0 space-y-4">
    <p className="text-sm text-muted-foreground">Consulta individual · Apenas disciplinas atribuídas ao professor. Sem acesso ao dossier administrativo ou financeiro.</p>
    <label className="block text-sm font-medium">Disciplina<select value={subject} onChange={event => setSubject(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base">{subjects.map(item => <option key={item.id} value={item.id}>{item.nome ?? "Disciplina"}</option>)}</select></label>
    <label className="block text-sm font-medium">Trimestre<select value={period ?? ""} disabled={!periodReady || periods.length === 0} onChange={event => setPeriod(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base"><option value="" disabled>Selecciona o período</option>{periods.map(item => <option key={item} value={item}>{item}.º trimestre</option>)}</select></label>
    {!subjects.length ? <p className="text-sm text-muted-foreground">Sem disciplinas atribuídas.</p> : periodError || error ? <div role="alert" className="space-y-2 rounded-xl border border-border p-3 text-sm"><p>{error ?? "Não foi possível consultar os períodos."}</p><button type="button" onClick={() => setRetry(n => n+1)} className="min-h-11 rounded-xl border border-border px-3 font-semibold text-primary">Tentar novamente</button></div>
    : periodReady && periods.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum trimestre configurado.</p>
    : !data ? <p role="status" className="text-sm text-muted-foreground">A carregar informação académica…</p>
    : !data.row ? <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">Sem registo para esta matrícula no período seleccionado.</p>
    : data.maximum === null ? <p className="text-sm text-muted-foreground">Esta disciplina não tem uma escala quantitativa disponível.</p>
    : <dl className="grid grid-cols-2 gap-3">{columns.map(item => <div key={item.label} className="rounded-xl border border-border bg-card p-3"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-primary">{typeof item.value === "number" && Number.isFinite(item.value) ? `${item.value} / ${data.maximum}` : "—"}</dd></div>)}</dl>}
  </div>;
}

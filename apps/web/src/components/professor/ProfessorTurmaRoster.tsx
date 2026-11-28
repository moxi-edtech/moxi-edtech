"use client";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { PortalDrawerPushButton, usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { ProfessorStudentGrades } from "@/components/professor/ProfessorStudentGrades";

type Student = { matricula_id: string; id: string | null; nome: string | null };
type Result = { ok: boolean; turmaId?: string; items?: Student[] };
export function ProfessorTurmaRoster({ turmaId, academicYearId = "", subjects = [] }: { turmaId: string; academicYearId?: string; subjects?: { id: string; nome: string | null }[] }) {
  const navigation = usePortalDrawerNavigation();
  const read = navigation?.read;
  const scope = JSON.stringify([turmaId, academicYearId]);
  const [result, setResult] = useState<{ scope: string; items: Student[] } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setResult(null);
    setError(false);
    void (async () => {
      try {
        const params = new URLSearchParams();
        if (academicYearId) params.set("ano_letivo_id", academicYearId);
        const response = await (read ? read(`/api/professor/turmas/${encodeURIComponent(turmaId)}/alunos${params.size ? "?" + params.toString() : ""}`, { signal: ctrl.signal, fresh: retry > 0 }) : fetch(`/api/professor/turmas/${encodeURIComponent(turmaId)}/alunos${params.size ? "?" + params.toString() : ""}`, { cache: "no-store", signal: ctrl.signal }));
        const payload = await response.json() as Result;
        if (!response.ok || !payload.ok || payload.turmaId !== turmaId || !Array.isArray(payload.items)) throw new Error("Turma indisponível");
        if (!ctrl.signal.aborted) setResult({ scope, items: payload.items });
      } catch {
        if (!ctrl.signal.aborted) setError(true);
      }
    })();
    return () => ctrl.abort();
  }, [turmaId, academicYearId, scope, retry, read]);
  const items = result?.scope === scope ? result.items : null;
  return <section className="space-y-3" aria-label="Alunos da turma">
    <h3 className="text-sm font-semibold text-foreground">Alunos da turma</h3>
    {error ? <div role="alert" className="rounded-xl border border-border p-3 text-sm"><p>Não foi possível consultar os alunos.</p><button type="button" onClick={() => setRetry(n => n + 1)} className="min-h-11 text-primary underline">Tentar novamente</button></div>
      : !items ? <p role="status" className="text-sm text-muted-foreground">A carregar alunos…</p>
      : items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
      : <><ul className="divide-y divide-border rounded-xl border border-border px-3">{items.map(item => <li key={item.matricula_id} className="break-words py-1 text-sm">{navigation && item.id ? <PortalDrawerPushButton frame={{ id: `${scope}:student:${item.matricula_id}`, title: item.nome || "Aluno", description: "Consulta individual do aluno nesta turma.", content: <ProfessorStudentGrades turmaId={turmaId} academicYearId={academicYearId} studentId={item.id} matriculaId={item.matricula_id} subjects={subjects} /> }} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-left font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 break-words">{item.nome || "Nome indisponível"}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></PortalDrawerPushButton> : item.nome || "Nome indisponível"}</li>)}</ul>{items.length >= 200 && <p className="text-xs text-muted-foreground">A lista pode estar limitada. Consulta a chamada para a gestão completa.</p>}</>}
  </section>;
}

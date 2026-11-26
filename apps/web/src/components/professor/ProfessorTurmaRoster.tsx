"use client";
import { useEffect, useState } from "react";

type Student = { matricula_id: string; id: string | null; nome: string | null };
type Result = { ok: boolean; turmaId?: string; items?: Student[] };
export function ProfessorTurmaRoster({ turmaId }: { turmaId: string }) {
  const [result, setResult] = useState<{ scope: string; items: Student[] } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setResult(null);
    setError(false);
    void (async () => {
      try {
        const response = await fetch(`/api/professor/turmas/${encodeURIComponent(turmaId)}/alunos`, { cache: "no-store", signal: ctrl.signal });
        const payload = await response.json() as Result;
        if (!response.ok || !payload.ok || payload.turmaId !== turmaId || !Array.isArray(payload.items)) throw new Error("Turma indisponível");
        if (!ctrl.signal.aborted) setResult({ scope: turmaId, items: payload.items });
      } catch {
        if (!ctrl.signal.aborted) setError(true);
      }
    })();
    return () => ctrl.abort();
  }, [turmaId, retry]);
  const items = result?.scope === turmaId ? result.items : null;
  return <section className="space-y-3" aria-label="Alunos da turma">
    <h3 className="text-sm font-semibold text-foreground">Alunos da turma</h3>
    {error ? <div role="alert" className="rounded-xl border border-border p-3 text-sm"><p>Não foi possível consultar os alunos.</p><button type="button" onClick={() => setRetry(n => n + 1)} className="min-h-11 text-primary underline">Tentar novamente</button></div>
      : !items ? <p role="status" className="text-sm text-muted-foreground">A carregar alunos…</p>
      : items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
      : <><ul className="divide-y divide-border rounded-xl border border-border px-3">{items.map(item => <li key={item.matricula_id} className="break-words py-2 text-sm">{item.nome || "Nome indisponível"}</li>)}</ul>{items.length >= 200 && <p className="text-xs text-muted-foreground">A lista pode estar limitada. Consulta a chamada para a gestão completa.</p>}</>}
  </section>;
}

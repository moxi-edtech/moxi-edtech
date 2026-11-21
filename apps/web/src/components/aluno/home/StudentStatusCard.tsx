import * as React from "react";
type Props = {
  loading: boolean;
  nome?: string;
  classe?: string | null;
  turma?: string | null;
  estadoAcademico?: string;
};

export function StudentStatusCard({ loading, nome, classe, turma, estadoAcademico }: Props) {
  if (loading) {
    return (
      <section role="status" aria-label="A carregar estado do aluno" aria-busy="true" className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <span className="sr-only">A carregar estado do aluno</span>
        <div aria-hidden="true" className="space-y-3">
          <div className="h-3 w-24 rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="h-6 w-48 max-w-full rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="h-4 w-40 max-w-full rounded-full bg-muted motion-safe:animate-pulse" />
          <div className="h-6 w-28 rounded-full bg-muted motion-safe:animate-pulse" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-klasse-green dark:text-emerald-300">Estado do aluno</p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">{nome?.trim() || "Aluno"}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {classe || "Classe —"} {turma ? `• ${turma}` : ""}
      </p>
      <span className="mt-3 inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground">
        {estadoAcademico?.trim() || "Sem estado"}
      </span>
    </section>
  );
}

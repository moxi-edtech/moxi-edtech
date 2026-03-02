type Props = {
  loading: boolean;
  nome?: string;
  classe?: string | null;
  turma?: string | null;
  estadoAcademico?: string;
};

export function StudentStatusCard({ loading, nome, classe, turma, estadoAcademico }: Props) {
  if (loading) {
    return <div className="h-28 animate-pulse rounded-xl bg-slate-100" />;
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">Estado do aluno</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{nome ?? "Aluno"}</h2>
      <p className="mt-2 text-sm text-slate-600">
        {classe ?? "Classe —"} {turma ? `• ${turma}` : ""}
      </p>
      <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        {estadoAcademico ?? "Sem estado"}
      </span>
    </section>
  );
}

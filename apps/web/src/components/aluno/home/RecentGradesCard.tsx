import { formatDate } from "@/lib/formatters";

type GradeItem = {
  disciplina: string;
  tipo: string;
  nota: number | null;
  data: string | null;
};

type Props = {
  loading: boolean;
  items: GradeItem[];
};

export function RecentGradesCard({ loading, items }: Props) {
  if (loading) {
    return (
      <section role="status" aria-busy="true" aria-label="A carregar avaliações recentes" className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <span className="sr-only">A carregar avaliações recentes</span>
        <div aria-hidden="true" className="space-y-3">
          <div className="h-4 w-40 rounded-full bg-muted motion-safe:animate-pulse" />
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded-full bg-muted motion-safe:animate-pulse" />
                <div className="h-3 w-1/2 rounded-full bg-muted motion-safe:animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="ml-auto h-4 w-10 rounded-full bg-muted motion-safe:animate-pulse" />
                <div className="h-3 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Últimas avaliações</h2>
      <ul className="mt-3 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Sem avaliações recentes.</li>
        ) : (
          items.map((item, idx) => (
            <li key={`${item.disciplina}-${idx}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground" title={item.disciplina}>{item.disciplina}</p>
                <p className="truncate text-xs text-muted-foreground">{item.tipo}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{item.nota ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

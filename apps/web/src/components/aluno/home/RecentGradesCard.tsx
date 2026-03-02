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

function shortDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export function RecentGradesCard({ loading, items }: Props) {
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Últimas avaliações</p>
      <ul className="mt-3 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-slate-500">Sem avaliações recentes.</li>
        ) : (
          items.map((item, idx) => (
            <li key={`${item.disciplina}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{item.disciplina}</p>
                <p className="text-xs text-slate-500">{item.tipo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{item.nota ?? "—"}</p>
                <p className="text-xs text-slate-500">{shortDate(item.data)}</p>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

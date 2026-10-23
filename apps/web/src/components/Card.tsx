export function Card({ title, value, icon: Icon }: { title: string; value: string; icon: any; }) {
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

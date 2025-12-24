import { Megaphone } from "lucide-react";

export function NoticePanel({
  items,
}: {
  items: Array<{ id: string; titulo: string; resumo: string; data: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <div className="h-8 w-8 rounded-xl bg-klasse-gold/10 text-klasse-gold ring-1 ring-klasse-gold/25 flex items-center justify-center">
          <Megaphone className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Avisos Gerais</h3>
      </div>

      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <EmptyNotices />
        ) : (
          items.map((item) => <NoticeItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

function NoticeItem({ item }: { item: { titulo: string; resumo: string; data: string } }) {
  return (
    <div className="p-4 hover:bg-slate-50 transition">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
        <span className="text-[11px] text-slate-400 whitespace-nowrap">
          {new Date(item.data).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2">{item.resumo}</p>
    </div>
  );
}

function EmptyNotices() {
  return (
    <div className="py-10 text-center text-slate-500">
      <div className="h-10 w-10 mx-auto mb-2 rounded-xl bg-slate-100 flex items-center justify-center">
        <Megaphone className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium">Sem avisos no momento</p>
      <p className="text-xs text-slate-400 mt-0.5">Nenhuma comunicação recente.</p>
    </div>
  );
}

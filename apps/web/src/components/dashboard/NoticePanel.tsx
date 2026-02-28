import Link from "next/link";
import { Megaphone } from "lucide-react";
import { EstadoVazio } from "@/components/harmonia";

type NoticeItemData = {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
  action_label?: string;
  action_href?: string;
};

export function NoticePanel({
  items,
  showHeader = true,
  title = "Avisos Gerais",
}: {
  items: NoticeItemData[];
  showHeader?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {showHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <div className="h-8 w-8 rounded-xl bg-klasse-gold/10 text-klasse-gold ring-1 ring-klasse-gold/25 flex items-center justify-center">
            <Megaphone className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
      )}

      <div className={`divide-y divide-slate-100 ${showHeader ? "" : "pt-2"}`}>
        {items.length === 0 ? (
          <div className="p-6">
            <EstadoVazio tipo="notificacoes.nenhuma" />
          </div>
        ) : (
          items.map((item) => <NoticeItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

function NoticeItem({ item }: { item: NoticeItemData }) {
  return (
    <div className="p-4 hover:bg-slate-50 transition">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
        <span className="text-[11px] text-slate-400 whitespace-nowrap">
          {new Date(item.data).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2">{item.resumo}</p>
      {item.action_label && item.action_href ? (
        <Link
          href={item.action_href}
          className="mt-2 inline-flex items-center rounded-md border border-[#1F6B3B]/20 px-2.5 py-1 text-[10px] font-bold text-[#1F6B3B] hover:bg-[#1F6B3B]/5"
        >
          {item.action_label}
        </Link>
      ) : null}
    </div>
  );
}

import { Megaphone } from "lucide-react";
import React from "react";
import { EmptyNotices } from "./EmptyNotices";
import { NoticeItem } from "./NoticeItem";

export function NoticePanel({
  items,
}: {
  items: Array<{
    id: string;
    titulo: string;
    resumo: string;
    data: string;
  }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <div
          className="
            h-8 w-8 rounded-xl
            bg-klasse-gold/10 text-klasse-gold
            ring-1 ring-klasse-gold/25
            flex items-center justify-center
          "
        >
          <Megaphone className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">
          Avisos Gerais
        </h3>
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

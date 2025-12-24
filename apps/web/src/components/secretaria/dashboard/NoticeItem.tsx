import React from "react";

export function NoticeItem({
  item,
}: {
  item: {
    titulo: string;
    resumo: string;
    data: string;
  };
}) {
  return (
    <div className="p-4 hover:bg-slate-50 transition">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">
          {item.titulo}
        </p>
        <span className="text-[11px] text-slate-400 whitespace-nowrap">
          {new Date(item.data).toLocaleDateString()}
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2">
        {item.resumo}
      </p>
    </div>
  );
}

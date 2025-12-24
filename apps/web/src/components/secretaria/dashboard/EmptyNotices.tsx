import { Megaphone } from "lucide-react";
import React from "react";

export function EmptyNotices() {
  return (
    <div className="py-10 text-center text-slate-500">
      <div className="h-10 w-10 mx-auto mb-2 rounded-xl bg-slate-100 flex items-center justify-center">
        <Megaphone className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium">Sem avisos no momento</p>
      <p className="text-xs text-slate-400 mt-0.5">
        Nenhuma comunicação recente.
      </p>
    </div>
  );
}

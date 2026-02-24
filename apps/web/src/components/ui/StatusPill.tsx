import React from "react";

type Variant = "matricula" | "financeiro";

function classesFor(status: string, variant: Variant): string {
  const s = status.toLowerCase();
  if (variant === "financeiro") {
    if (s === "pago" || s === "em_dia") return "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20";
    if (s.includes("atras") || s === "inadimplente") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/30";
  }

  if (s === "ativo") return "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20";
  if (s === "arquivado" || s === "inativo") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/30";
}

export function StatusPill({ status, variant = "matricula", size = "sm" }: { status?: string | null; variant?: Variant; size?: "sm" | "xs" }) {
  const label = status?.replace(/_/g, " ") ?? "—";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wide ${size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"} ${classesFor(label, variant)}`}
    >
      {label}
    </span>
  );
}

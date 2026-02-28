// apps/web/src/components/super-admin/escolas/SchoolsHeader.tsx
"use client"

import { useRouter } from "next/navigation";
import { Plus, Wrench } from "lucide-react";

type SchoolsHeaderProps = {
  fallbackSource?: string | null;
  onRepairAdmins: (dryRun: boolean) => void;
  loading: boolean;
};

export function SchoolsHeader({ fallbackSource, onRepairAdmins, loading }: SchoolsHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#E3B23C]" />
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            Gestão de Infraestrutura
          </h3>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
          Nossas Escolas
          {fallbackSource && (
            <span
              title="A usar base de dados de contingência"
              className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-[#E3B23C] border border-amber-100"
            >
              Modo Contingência
            </span>
          )}
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-2 max-w-lg">
          Acompanhe, configure e apoie todas as unidades que utilizam o ecossistema Klasse.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={() => onRepairAdmins(true)} 
          disabled={loading}
          className="h-11 px-5 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <Wrench size={14} /> Auditoria de Admins
          </div>
        </button>
        
        <button 
          onClick={() => router.push("/super-admin/escolas/nova")}
          className="h-11 px-6 rounded-2xl bg-[#1F6B3B] text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 shadow-[0_10px_20px_rgba(31,107,59,0.2)] transition-all active:scale-95"
        >
          <div className="flex items-center gap-2">
            <Plus size={16} strokeWidth={3} /> Provisionar Unidade
          </div>
        </button>
      </div>
    </div>
  );
}

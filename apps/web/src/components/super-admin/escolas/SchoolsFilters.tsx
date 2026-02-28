// apps/web/src/components/super-admin/escolas/SchoolsFilters.tsx
"use client"

import { Search } from "lucide-react";

type SchoolsFiltersProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  planFilter: string;
  onPlanFilterChange: (value: string) => void;
  totalStudents: number;
  totalTeachers: number;
  onboardingSummary: {
    inProgress: number;
    done: number;
  };
};

export function SchoolsFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  planFilter,
  onPlanFilterChange,
  totalStudents,
  totalTeachers,
  onboardingSummary,
}: SchoolsFiltersProps) {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-200/60 p-6 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-[#1F6B3B] transition-colors" />
            <input
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar unidade, cidade ou responsável..."
              className="pl-11 pr-4 h-11 border border-slate-200 bg-slate-50/50 rounded-2xl text-sm font-medium w-full sm:w-80 outline-none focus:bg-white focus:border-[#1F6B3B] focus:ring-4 focus:ring-[#1F6B3B]/5 transition-all"
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => onStatusFilterChange(e.target.value)} 
            className="h-11 border border-slate-200 bg-white rounded-2xl px-4 text-xs font-bold uppercase tracking-widest text-slate-500 outline-none focus:border-[#1F6B3B] transition-all cursor-pointer"
          >
            <option value="all">Todos os Estados</option>
            <option value="ativa">Ativa</option>
            <option value="pendente">Pendente</option>
            <option value="suspensa">Suspensa</option>
          </select>

          <select 
            value={planFilter} 
            onChange={(e) => onPlanFilterChange(e.target.value)} 
            className="h-11 border border-slate-200 bg-white rounded-2xl px-4 text-xs font-bold uppercase tracking-widest text-slate-500 outline-none focus:border-[#1F6B3B] transition-all cursor-pointer"
          >
            <option value="all">Todos os Planos</option>
            <option value="Essencial">Essencial</option>
            <option value="Profissional">Profissional</option>
            <option value="Premium">Premium</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-6 items-center px-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alunos</span>
            <span className="text-sm font-black text-[#1F6B3B]">{totalStudents.toLocaleString()}</span>
          </div>
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Professores</span>
            <span className="text-sm font-black text-slate-900">{totalTeachers.toLocaleString()}</span>
          </div>
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Onboarding</span>
            <span className="text-sm font-black text-[#E3B23C]">{onboardingSummary.done} prontos / {onboardingSummary.inProgress} em curso</span>
          </div>
        </div>
      </div>
    </div>
  );
}

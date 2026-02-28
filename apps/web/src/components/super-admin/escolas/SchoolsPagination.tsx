// apps/web/src/components/super-admin/escolas/SchoolsPagination.tsx
"use client"

import { ChevronLeft, ChevronRight } from "lucide-react";

type SchoolsPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function SchoolsPagination({ currentPage, totalPages, onPageChange }: SchoolsPaginationProps) {
  if (totalPages <= 1) return null;

  const btnCls = "h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-[#1F6B3B] hover:border-[#1F6B3B] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm";

  return (
    <div className="mt-8 flex items-center justify-center gap-6">
      <button 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1} 
        className={btnCls}
      >
        <ChevronLeft size={18} />
      </button>
      
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página</span>
        <span className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-900">
          {currentPage}
        </span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">de {Math.max(1, totalPages)}</span>
      </div>

      <button 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages} 
        className={btnCls}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

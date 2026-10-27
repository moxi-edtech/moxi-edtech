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

  const btnCls = "h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-ring transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm";

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
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Página</span>
        <span className="h-9 px-3 rounded-xl bg-muted border border-border flex items-center justify-center text-xs font-black text-foreground">
          {currentPage}
        </span>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">de {Math.max(1, totalPages)}</span>
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

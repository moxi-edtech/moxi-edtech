import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type SchoolsPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function SchoolsPagination({ currentPage, totalPages, onPageChange }: SchoolsPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <button 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1} 
        className="px-2 py-1 rounded border disabled:opacity-50"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <span className="text-sm">Página {currentPage} de {Math.max(1, totalPages)}</span>
      <button 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages} 
        className="px-2 py-1 rounded border disabled:opacity-50"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
            <input
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nome, cidade ou responsável"
              className="pl-8 pr-3 py-2 border rounded-md text-sm w-64"
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => onStatusFilterChange(e.target.value)} 
            className="border rounded px-2 py-2 text-sm"
          >
            <option value="all">Todos status</option>
            <option value="ativa">Ativa</option>
            <option value="pendente">Pendente</option>
            <option value="suspensa">Suspensa</option>
          </select>
          <select 
            value={planFilter} 
            onChange={(e) => onPlanFilterChange(e.target.value)} 
            className="border rounded px-2 py-2 text-sm"
          >
            <option value="all">Todos planos</option>
            <option value="Básico">Básico</option>
            <option value="Standard">Standard</option>
            <option value="Premium">Premium</option>
          </select>
        </div>
        <div className="text-sm text-gray-600 flex gap-4">
          <span>{totalStudents} alunos</span>
          <span>{totalTeachers} professores</span>
          <span>{onboardingSummary.inProgress} em onboarding</span>
          <span>{onboardingSummary.done} concluído</span>
        </div>
      </div>
    </div>
  );
}
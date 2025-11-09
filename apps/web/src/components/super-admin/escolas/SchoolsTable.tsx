import { SchoolRow } from "./SchoolRow";
import type { School, OnboardingProgress, EditForm } from "./types";

type SchoolsTableProps = {
  schools: School[];
  progress: Record<string, OnboardingProgress>;
  loading: boolean;
  editingId: string | number | null;
  editForm: EditForm;
  saving: string | number | null;
  onEdit: (school: School) => void;
  onSave: (schoolId: string | number) => void;
  onCancel: () => void;
  onInputChange: (field: keyof School, value: string) => void;
  onViewDetails: (schoolId: string | number) => void;
  onEnterPortal: (schoolId: string | number) => void;
  onSendBilling: (schoolId: string | number) => void;
  onSuspend: (school: School) => void;
  onDelete: (school: School) => void;
};

export function SchoolsTable({
  schools,
  progress,
  loading,
  editingId,
  editForm,
  saving,
  onEdit,
  onSave,
  onCancel,
  onInputChange,
  onViewDetails,
  onEnterPortal,
  onSendBilling,
  onSuspend,
  onDelete,
}: SchoolsTableProps) {
  if (loading) {
    return <TableSkeleton />;
  }

  if (schools.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        <div className="py-8 text-center text-gray-500">
          Nenhuma escola encontrada
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader />
          <tbody className="divide-y divide-gray-200">
            {schools.map((school) => (
              <SchoolRow
                key={school.id}
                school={school}
                progress={progress[String(school.id)]}
                editingId={editingId}
                editForm={editForm}
                saving={saving}
                onEdit={onEdit}
                onSave={onSave}
                onCancel={onCancel}
                onInputChange={onInputChange}
                onViewDetails={onViewDetails}
                onEnterPortal={onEnterPortal}
                onSendBilling={onSendBilling}
                onSuspend={onSuspend}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Escola</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localização</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarding</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plano</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Acesso</th>
        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </tr>
    </thead>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader />
          <tbody className="divide-y divide-gray-200">
            {[...Array(5)].map((_, i) => (
              <tr key={`sk-${i}`}>
                <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" /></td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" /></td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" /></td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" /></td>
                <td className="py-4 px-4"><div className="h-6 bg-gray-200 rounded-full animate-pulse w-16" /></td>
                <td className="py-4 px-4"><div className="h-6 bg-gray-200 rounded-full animate-pulse w-24" /></td>
                <td className="py-4 px-4"><div className="h-6 bg-gray-200 rounded-full animate-pulse w-20" /></td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-24" /></td>
                <td className="py-4 px-4">
                  <div className="flex gap-2">
                    <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                    <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                    <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
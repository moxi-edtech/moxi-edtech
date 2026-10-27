// apps/web/src/components/super-admin/escolas/SchoolsTable.tsx
"use client"

import { SchoolRow } from "./SchoolRow";
import type { School, OnboardingProgress, EditForm } from "./types";
import { Info } from "lucide-react";

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
      <div className="bg-card rounded-[2.5rem] border border-border/60 p-20 text-center shadow-sm">
        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
          <Info size={32} />
        </div>
        <h3 className="text-base font-bold text-foreground uppercase tracking-tight">Nenhuma unidade encontrada</h3>
        <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros para encontrar o que procura.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-[2.5rem] border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full text-left">
          <TableHeader />
          <tbody className="divide-y divide-border">
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
    <thead className="bg-muted/50 border-b border-border">
      <tr>
        <th className="py-5 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Escola</th>
        <th className="py-5 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Responsável</th>
        <th className="py-5 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Localização</th>
        <th className="py-5 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Estado</th>
        <th className="py-5 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Saúde</th>
        <th className="py-5 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Plano</th>
        <th className="py-5 px-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Acções</th>
      </tr>
    </thead>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-card rounded-[2.5rem] border border-border/60 p-8 space-y-4 shadow-sm animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-muted rounded-2xl w-full" />
      ))}
    </div>
  );
}

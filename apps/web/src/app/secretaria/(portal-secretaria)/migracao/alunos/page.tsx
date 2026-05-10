import { Suspense } from "react";
import AlunoMigrationWizard from "@/app/migracao/alunos/wizard";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function Page() {
  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Migração de Alunos"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Migração", href: "/secretaria/migracao/historico" },
          { label: "Alunos" },
        ]}
      />
      <Suspense fallback={<div>A carregar...</div>}>
        <AlunoMigrationWizard />
      </Suspense>
    </div>
  );
}

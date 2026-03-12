import { Suspense } from "react";
import AlunoMigrationWizard from "@/app/migracao/alunos/wizard";

export default function Page() {
  return (
    <Suspense fallback={<div>A carregar...</div>}>
      <AlunoMigrationWizard />
    </Suspense>
  );
}

import { Suspense } from "react";
import FechamentoAcademicoPage from "@/app/secretaria/(portal-secretaria)/fechamento-academico/page";

export const dynamic = "force-dynamic";

export default function AdminOperacoesAcademicasWizardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">A carregar wizard...</div>}>
      <FechamentoAcademicoPage />
    </Suspense>
  );
}

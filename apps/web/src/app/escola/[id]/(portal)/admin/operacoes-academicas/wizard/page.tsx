// apps/web/src/app/escola/[id]/(portal)/admin/operacoes-academicas/wizard/page.tsx
import { ViradaWizard } from "@/components/secretaria/virada-ano/ViradaWizard";
import AuditPageView from "@/components/audit/AuditPageView";

export default function ViradaWizardPage() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="admin_escola" acao="PAGE_VIEW" entity="virada_ano_wizard" />
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Fechamento & Virada de Ano
        </h1>
      </div>

      <ViradaWizard />
    </div>
  );
}

import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { CartaoEstudante } from "@/components/aluno/tabs/CartaoEstudante";

export default function IdentidadePage() {
  return (
    <div className="flex min-h-[60vh] min-w-0 flex-col justify-center space-y-4">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="identidade_digital" />
      <Suspense fallback={<div role="status" aria-label="A carregar cartão do estudante" className="h-64 animate-pulse rounded-xl border border-border bg-card" />}>
        <CartaoEstudante />
      </Suspense>
    </div>
  );
}

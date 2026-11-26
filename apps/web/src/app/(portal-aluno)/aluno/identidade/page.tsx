import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { CartaoEstudante } from "@/components/aluno/tabs/CartaoEstudante";

export default function IdentidadePage() {
  return (
    <div className="min-w-0 space-y-4">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="identidade_digital" />
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Cartão do estudante</h1>
      <Suspense fallback={<div role="status" aria-label="A carregar cartão do estudante" className="h-64 animate-pulse rounded-xl border border-border bg-card" />}>
        <CartaoEstudante />
      </Suspense>
    </div>
  );
}

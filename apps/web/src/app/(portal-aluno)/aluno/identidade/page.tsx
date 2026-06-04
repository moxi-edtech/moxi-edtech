import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { CartaoEstudante } from "@/components/aluno/tabs/CartaoEstudante";

export default function IdentidadePage() {
  return (
    <div className="space-y-4 bg-slate-50 min-h-[60vh] flex flex-col justify-center">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="identidade_digital" />
      <Suspense fallback={<div className="h-64 rounded-3xl bg-white animate-pulse" />}>
        <CartaoEstudante />
      </Suspense>
    </div>
  );
}

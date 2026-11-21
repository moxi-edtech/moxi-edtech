import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { TabPerfil } from "@/components/aluno/tabs/TabPerfil";

export default function PerfilPage() {
  return (
    <div className="min-w-0 space-y-4">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="perfil" />
      <Suspense fallback={<div role="status" aria-label="A carregar perfil" className="h-40 animate-pulse rounded-xl border border-border bg-card" />}>
        <TabPerfil />
      </Suspense>
    </div>
  );
}

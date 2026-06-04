import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { TabPerfil } from "@/components/aluno/tabs/TabPerfil";

export default function PerfilPage() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="perfil" />
      <Suspense fallback={<div className="h-64 rounded-3xl bg-white animate-pulse" />}>
        <TabPerfil />
      </Suspense>
    </div>
  );
}

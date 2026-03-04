import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { HomePageClient } from "@/components/aluno/home/HomePageClient";

export default function HomePage() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="home" />
      <Suspense fallback={<div className="h-32 rounded-2xl bg-white" />}>
        <HomePageClient />
      </Suspense>
    </div>
  );
}

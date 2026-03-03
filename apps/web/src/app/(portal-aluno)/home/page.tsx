import AuditPageView from "@/components/audit/AuditPageView";
import { HomePageClient } from "@/components/aluno/home/HomePageClient";

export default function HomePage() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="home" />
      <HomePageClient />
    </div>
  );
}

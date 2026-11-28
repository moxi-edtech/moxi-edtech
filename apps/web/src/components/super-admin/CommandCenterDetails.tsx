"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import CrmSection from "@/components/super-admin/CrmSection";
import MarketingSection from "@/components/super-admin/MarketingSection";
import QuickActionsSection from "@/components/super-admin/QuickActionsSection";

function DeferredSection({ title, children }: { title: string; children: ReactNode }) {
  const [visited, setVisited] = useState(false);
  return (
    <details onToggle={(event) => { if (event.currentTarget.open) setVisited(true); }}
      className="group min-w-0 rounded-xl border border-border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {title}<ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      {visited && <div className="min-w-0 overflow-x-auto border-t border-border p-3 sm:p-4">{children}</div>}
    </details>
  );
}

export default function CommandCenterDetails({ finance, schools }: { finance: ReactNode; schools: ReactNode }) {
  return (
    <section aria-labelledby="super-admin-details-title" className="min-w-0 space-y-3">
      <h2 id="super-admin-details-title" className="text-base font-semibold text-foreground">Análise e ferramentas</h2>
      <DeferredSection title="Acompanhamento das escolas">{schools}</DeferredSection>
      <DeferredSection title="Pagamentos das escolas">{finance}</DeferredSection>
      <DeferredSection title="Marketing e parceiros"><MarketingSection /></DeferredSection>
      <DeferredSection title="Pipeline comercial e pós-venda"><CrmSection /></DeferredSection>
      <DeferredSection title="Ferramentas avançadas"><QuickActionsSection /></DeferredSection>
    </section>
  );
}

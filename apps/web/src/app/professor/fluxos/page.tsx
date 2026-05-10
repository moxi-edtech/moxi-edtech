import Mermaid from "@/components/Mermaid"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { fluxoAcademico } from "@/lib/diagrams"

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-5 sm:p-6 space-y-4">
        <div>
          <DashboardHeader
            title="Fluxo Acadêmico"
            description="Visão contínua do processo acadêmico."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Professor", href: "/professor" },
              { label: "Fluxos" },
            ]}
          />
        </div>
        <Mermaid chart={fluxoAcademico} className="overflow-auto rounded-xl border border-slate-200 bg-white p-4" />
      </div>
    </div>
  )
}

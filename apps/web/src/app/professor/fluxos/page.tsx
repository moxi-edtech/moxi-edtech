import Mermaid from "@/components/Mermaid"
import { fluxoAcademico } from "@/lib/diagrams"

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-klasse-green">Fluxo acadêmico</h1>
          <p className="text-sm text-slate-500">Visão contínua do processo acadêmico.</p>
        </div>
        <Mermaid chart={fluxoAcademico} className="overflow-auto rounded-xl border border-slate-200 bg-white p-4" />
      </div>
    </div>
  )
}

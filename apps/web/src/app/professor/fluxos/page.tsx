import Mermaid from "@/components/Mermaid"
import { fluxoAcademico } from "@/lib/diagrams"

export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Fluxos do Professor</h1>
      <p className="text-sm text-gray-600 mb-3">Visão de ponta a ponta do processo acadêmico.</p>
      <Mermaid chart={fluxoAcademico} className="overflow-auto rounded-lg border bg-white p-4" />
    </div>
  )
}


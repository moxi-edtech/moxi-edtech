import Sidebar from '@/components/super-admin/Sidebar'
import Header from '@/components/super-admin/Header'
import Mermaid from '@/components/Mermaid'
import { fluxoCriacaoAdmin } from '@/lib/diagrams'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="p-6 overflow-y-auto space-y-6">
          <h1 className="text-2xl font-bold">Fluxo: Criação de Escola e Admin</h1>
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-moxinexa-light/30">
            <Mermaid chart={fluxoCriacaoAdmin} className="overflow-auto rounded-lg border bg-white p-4" />
          </div>
        </main>
      </div>
    </div>
  )
}


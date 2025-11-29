import EscolaAdminSidebar from "@/components/escola-admin/Sidebar";
import AppHeader from "@/components/layout/shared/AppHeader";
import EscolaAdminDashboardData from "./EscolaAdminDashboardData";

type Props = { escolaId: string; escolaNome?: string };

export default function EscolaAdminDashboard({ escolaId, escolaNome }: Props) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <EscolaAdminSidebar escolaId={escolaId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header atualizado para combinar com o design */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-sm font-semibold text-slate-500">
            Ano Letivo: <span className="text-slate-900 font-bold">2024/2025</span>
          </h2>
          <div className="flex gap-4">
            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM8.5 14.5a2.5 2.5 0 00-5 0 2.5 2.5 0 005 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
            <EscolaAdminDashboardData escolaId={escolaId} escolaNome={escolaNome} />
          </div>
        </main>
      </div>
    </div>
  );
}
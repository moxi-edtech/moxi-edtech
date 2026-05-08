"use client";

import { useSearchParams } from "next/navigation";
import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function BalcaoPageClient({ escolaId, escolaParam }: { escolaId: string, escolaParam: string }) {
  const searchParams = useSearchParams();
  const alunoId = searchParams?.get("alunoId") ?? null;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href={`/escola/${escolaParam}/secretaria`}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Balcão de Atendimento</h1>
              <p className="text-xs text-slate-500">Gestão de pagamentos e serviços</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
          <BalcaoAtendimento 
            escolaId={escolaId} 
            selectedAlunoId={alunoId}
            showSearch={true}
          />
        </div>
      </main>
    </div>
  );
}

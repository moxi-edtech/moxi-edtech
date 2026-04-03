"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import StructureMarketplace from "@/components/escola/settings/StructureMarketplace";

type Props = {
  params: Promise<{ id: string }>;
};

export default function EstruturaPage({ params }: Props) {
  const { id: escolaId } = use(params);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-900">
      
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
            <Link 
                href={`/escola/${escolaId}/admin/configuracoes`} 
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-4"
            >
                <ArrowLeft className="w-4 h-4"/> Voltar às definições
            </Link>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Oferta Formativa</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Gerencie os cursos e níveis de ensino disponíveis na escola.</p>
                </div>
                <div className="hidden md:block p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-400">
                    <Settings className="w-6 h-6"/>
                </div>
            </div>
        </div>

        {/* O Marketplace */}
        <StructureMarketplace escolaId={escolaId} />

      </div>
    </div>
  );
}
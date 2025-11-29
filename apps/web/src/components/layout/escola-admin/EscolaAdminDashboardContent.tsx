"use client";

import { useState } from "react";
import DashboardHero from "./DashboardHero";
import KpiSection, { KpiStats } from "./KpiSection";
import NoticesSection from "./NoticesSection";
import EventsSection from "./EventsSection";
import AcademicSection from "./AcademicSection";
import QuickActionsSection from "./QuickActionsSection";
import ChartsSection from "./ChartsSection";
import type { PagamentosResumo } from "./definitions";

// --- TIPOS ---
type Aviso = { id: string; titulo: string; dataISO: string };
type Evento = { id: string; titulo: string; dataISO: string };

type Props = {
  escolaId?: string;
  pagamentosKpis?: PagamentosResumo;
  loading?: boolean;
  error?: string | null;
  notices?: Aviso[];
  events?: Evento[];
  charts?: { meses: string[]; alunosPorMes: number[]; pagamentos: PagamentosResumo };
  // Adicionei estas props para alimentar a KPI Section corretamente
  stats?: KpiStats; 
};

export default function EscolaAdminDashboardContent({
  escolaId,
  loading,
  error,
  notices,
  events,
  charts,
  stats, // Assumindo que vem do Data wrapper
}: Props) {
  
  // Lógica de Estado Vazio: Se tiver menos de 5 alunos, consideramos "Start Mode"
  const isStartMode = (stats?.alunos || 0) < 5; 

  const handleImport = () => {
    // Aqui podes abrir o Modal de Importação que criámos no HTML
    alert("Abrir modal de importação...");
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. Header & KPIs (Sempre visíveis para dar contexto) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-sm font-medium text-slate-500">Visão geral da escola</p>
          </div>
          <div className="hidden md:block">
             <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
               Ano Letivo: 2024/2025
             </span>
          </div>
        </div>

        {/* KPIs passam stats vindos da prop */}
        <KpiSection escolaId={escolaId} stats={stats} loading={loading} error={error} />
      </div>

      {/* 2. DECISÃO DE HERO vs STANDARD */}
      {isStartMode ? (
        
        // MODO ARRANQUE (HERO)
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <DashboardHero 
            onImportClick={handleImport} 
            onManualClick={() => window.location.href = `/escola/${escolaId}/admin/alunos/novo`} 
          />
          
          <div className="mt-8 grid gap-6 opacity-60 pointer-events-none filter grayscale">
             {/* Mostra o resto desativado para dar vontade de preencher */}
             <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <NoticesSection notices={[]} />
                <EventsSection events={[]} />
             </div>
          </div>
        </div>

      ) : (
        
        // MODO CRUZEIRO (Dashboard Normal)
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Charts Row */}
          <ChartsSection 
            meses={charts?.meses} 
            alunosPorMes={charts?.alunosPorMes} 
            pagamentos={charts?.pagamentos} 
          />

          {/* Actions & Academic */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
               <QuickActionsSection />
            </div>
            <div>
               <AcademicSection />
            </div>
          </div>

          {/* Info Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NoticesSection notices={notices} />
            <EventsSection events={events} />
          </div>
        </div>
      )}
    </div>
  );
}
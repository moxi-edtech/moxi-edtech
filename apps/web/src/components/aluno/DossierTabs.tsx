"use client";

import { useState } from "react";
import { BookOpen, FileText, Users, Wallet } from "lucide-react";
import type { AlunoNormalizado } from "@/lib/aluno/types";

type DossierTab = "perfil" | "financeiro" | "historico" | "documentos";
type TabItem = { id: DossierTab; label: string; icon: React.ReactNode; badge?: number | null };

export function DossierTabs({ aluno, slotPerfil, slotFinanceiro, slotHistorico, slotDocumentos }: { aluno: AlunoNormalizado; slotPerfil: React.ReactNode; slotFinanceiro: React.ReactNode; slotHistorico: React.ReactNode; slotDocumentos: React.ReactNode }) {
  const [active, setActive] = useState<DossierTab>("perfil");
  const slots = { perfil: slotPerfil, financeiro: slotFinanceiro, historico: slotHistorico, documentos: slotDocumentos };
  const tabs: TabItem[] = [
    { id: "perfil", label: "Perfil", icon: <Users size={13} /> },
    { id: "financeiro", label: "Financeiro", icon: <Wallet size={13} />, badge: aluno.financeiro.mensalidades_atrasadas.length || null },
    { id: "historico", label: "Histórico", icon: <BookOpen size={13} /> },
    { id: "documentos", label: "Documentos", icon: <FileText size={13} /> },
  ] as const;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex gap-1 border-b border-slate-200 px-5 pt-4 -mb-px">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActive(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 ${active === tab.id ? "border-[#1F6B3B] text-[#1F6B3B]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            {tab.icon}
            {tab.label}
            {tab.badge ? <span className="rounded-full px-2 py-0.5 text-[9px] font-black bg-rose-100 text-rose-700">{tab.badge}</span> : null}
          </button>
        ))}
      </div>
      <div className="p-6">{slots[active]}</div>
    </div>
  );
}

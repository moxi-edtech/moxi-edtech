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
      <div className="flex gap-1 border-b border-slate-200 bg-slate-50/50 px-5 pt-4 -mb-px">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm border-b-2 ${
                isActive
                  ? "border-slate-900 text-slate-900 font-bold"
                  : "border-transparent text-slate-400 font-medium hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge ? (
                <span className="absolute -top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="p-6">{slots[active]}</div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Building2, Rocket, Plus } from "lucide-react";
import { RegistarVendaB2BForm } from "./RegistarVendaB2BForm";
import Link from "next/link";

type Props = {
  cohorts: { id: string; nome: string; curso_nome: string }[];
};

export function DashboardActions({ cohorts }: Props) {
  const [showB2B, setShowB2B] = useState(false);

  return (
    <>
      <section className="grid grid-cols-2 gap-4">
        <Link 
          href="/mentor/mentorias/nova"
          className="flex flex-col items-center justify-center gap-4 rounded-[2.5rem] bg-white border border-slate-200 p-8 shadow-lg active:scale-95 transition-all hover:border-klasse-gold/30 group"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-klasse-gold/10 text-klasse-gold group-hover:scale-110 transition-transform">
            <Rocket size={28} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Lançar Mentoria</span>
        </Link>

        <button 
          onClick={() => setShowB2B(true)}
          className="flex flex-col items-center justify-center gap-4 rounded-[2.5rem] bg-white border border-slate-200 p-8 shadow-lg active:scale-95 transition-all hover:border-emerald-200 group"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
            <Building2 size={28} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Registar B2B</span>
        </button>
      </section>
...

      {showB2B && (
        <RegistarVendaB2BForm 
          cohorts={cohorts} 
          onClose={() => setShowB2B(false)} 
        />
      )}
    </>
  );
}

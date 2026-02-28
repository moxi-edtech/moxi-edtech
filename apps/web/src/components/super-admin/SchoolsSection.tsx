// apps/web/src/components/super-admin/SchoolsSection.tsx
"use client"

import { CheckCircle2, CircleDashed, ArrowRight } from "lucide-react"

interface Escola {
  id: string
  nome: string
  plano: string
  onboarding_finalizado: boolean
  progresso_onboarding: number
  alunos_ativos: number
}

interface Props {
  escolas: Escola[]
}

export default function SchoolsSection({ escolas }: { escolas: Escola[] }) {
  return (
    <section className="bg-white p-10 rounded-[3rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Acompanhamento da Rede</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            Progresso de integração das nossas escolas
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#1F6B3B] bg-[#1F6B3B]/5 px-3 py-1 rounded-full uppercase tracking-widest">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1F6B3B] animate-pulse" />
          {escolas.length} Unidades
        </div>
      </div>

      <div className="grid gap-4">
        {escolas.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
            <p className="text-slate-400 text-sm font-medium">Ainda não temos escolas em fase de activação.</p>
          </div>
        ) : (
          escolas.map((escola) => (
            <div 
              key={escola.id} 
              className="group flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-[2rem] bg-white border border-slate-100 hover:border-[#1F6B3B]/20 hover:shadow-[0_15px_30px_rgba(0,0,0,0.03)] transition-all duration-300"
            >
              {/* Info da Escola */}
              <div className="flex items-center gap-5 min-w-0 md:w-1/3">
                <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-[#1F6B3B]/5 transition-colors">
                  <span className="text-lg font-black text-slate-400 group-hover:text-[#1F6B3B] transition-colors">
                    {escola.nome.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate uppercase tracking-tight">
                    {escola.nome}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Plano {escola.plano}
                  </p>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="flex-1 max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {escola.onboarding_finalizado ? "Tudo pronto para operar" : "Em fase de configuração"}
                  </span>
                  <span className="text-[10px] font-black text-slate-900">{escola.progresso_onboarding}%</span>
                </div>
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-100">
                  <div 
                    className="h-full rounded-full bg-[#1F6B3B] transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(31,107,59,0.3)]"
                    style={{ width: `${escola.progresso_onboarding}%` }}
                  />
                </div>
              </div>

              {/* Status e Acção */}
              <div className="flex items-center justify-end gap-6 md:w-1/4">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alunos</p>
                  <p className="text-sm font-black text-slate-900">{escola.alunos_ativos.toLocaleString()}</p>
                </div>
                
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  escola.onboarding_finalizado ? "bg-emerald-50 text-[#1F6B3B]" : "bg-slate-50 text-slate-300"
                }`}>
                  {escola.onboarding_finalizado ? <CheckCircle2 size={20} /> : <CircleDashed size={20} className="animate-spin-slow" />}
                </div>

                <button className="h-10 w-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 hover:text-[#1F6B3B] hover:border-[#1F6B3B] hover:bg-white transition-all group/btn shadow-sm">
                  <ArrowRight size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

"use client";

import { GraduationCap, ShieldCheck, MessageCircle, Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { AdmissionConfig } from "../AdmissionForm";

export function PublicHero({ config }: { config: AdmissionConfig }) {
  const primaryColor = config.escola.cor_primaria || "#1F6B3B";
  const hasWhatsappSupport = Boolean(config.escola.config_portal?.whatsapp_suporte);

  const handleScrollToForm = () => {
    document.getElementById("admissao-catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative mx-3 mt-3 max-w-6xl overflow-hidden rounded-[1.5rem] border border-emerald-950/10 bg-[#fff8ec] px-5 py-8 shadow-[0_24px_60px_rgba(15,76,49,0.12)] sm:mx-4 sm:mt-6 sm:rounded-[2rem] sm:px-12 sm:py-16 lg:mx-auto lg:mt-10 lg:px-16 lg:py-20">
      <div 
        className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: primaryColor }}
      />
      <div 
        className="pointer-events-none absolute -bottom-24 left-8 h-80 w-80 rounded-full bg-amber-300/45 blur-3xl"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.68),transparent_42%,rgba(15,76,49,0.08))]" />

      <div className="relative z-10 grid gap-6 sm:gap-10 lg:grid-cols-[1fr_340px] lg:items-center lg:gap-12">
        <div className="space-y-5 sm:space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-950/10 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-800 shadow-sm backdrop-blur-sm sm:px-4 sm:py-2 sm:text-xs">
            <GraduationCap size={16} />
            Inscrições Abertas {config.ano_letivo?.ano || "vigente"}
          </div>
          
          <div className="space-y-3 sm:space-y-6">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-800 sm:mb-3 sm:text-sm sm:tracking-[0.24em]">
                {config.escola.nome}
              </p>
              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl md:text-6xl lg:leading-[1.05]">
                O futuro do seu filho começa aqui.
              </h1>
            </div>
            <p className="max-w-xl text-sm font-medium leading-relaxed text-slate-600 sm:text-lg">
              Faça a pré-inscrição online, escolha o nível de ensino, classe/turma e turno, e acompanhe o estado da sua candidatura sem sair de casa.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:pt-2">
            <button
              onClick={handleScrollToForm}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 font-black text-white shadow-[0_14px_28px_rgba(15,76,49,0.2)] transition hover:brightness-110 sm:h-12 sm:rounded-2xl sm:px-6"
              style={{ backgroundColor: primaryColor }}
            >
              Começar Inscrição
              <ArrowRight size={18} />
            </button>
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-600 sm:justify-start sm:gap-6 sm:text-sm">
              <span className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-700" />
                Oficial
              </span>
              {hasWhatsappSupport && (
                <span className="flex items-center gap-2">
                  <MessageCircle size={18} className="text-emerald-700" />
                  Suporte WhatsApp
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-emerald-950/10 bg-white/80 p-4 shadow-[0_18px_45px_rgba(45,34,12,0.1)] backdrop-blur-md sm:rounded-[1.75rem] sm:p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 sm:mb-5 sm:h-12 sm:w-12 sm:rounded-2xl">
            <Search size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-950">Já submeteu uma candidatura?</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
            Use o seu código de protocolo para ver o estado do processo ou enviar documentos pendentes.
          </p>
          <Link
            href={`/admissoes/${config.escola.slug}/consultar`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-slate-800 sm:mt-6 sm:rounded-2xl sm:py-3"
          >
            Consultar Inscrição
          </Link>
        </div>
      </div>
    </section>
  );
}

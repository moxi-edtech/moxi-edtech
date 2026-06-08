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
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-16 sm:px-12 sm:py-24 lg:px-16 shadow-2xl mx-4 lg:mx-auto max-w-6xl mt-6 lg:mt-10 border border-slate-800">
      {/* Decorative Blobs */}
      <div 
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl opacity-30 mix-blend-screen pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />
      <div 
        className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full blur-3xl opacity-20 mix-blend-screen pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />

      <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_340px] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-300 backdrop-blur-sm shadow-inner">
            <GraduationCap size={16} />
            Inscrições Abertas {config.ano_letivo?.ano || "vigente"}
          </div>
          
          <div className="space-y-6">
            <div>
              <p className="text-lg font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">
                {config.escola.nome}
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl lg:leading-[1.1]">
                O futuro do seu filho começa aqui.
              </h1>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-slate-300">
              Faça a pré-inscrição online, escolha o nível de ensino, classe/turma e turno, e acompanhe o estado da sua candidatura sem sair de casa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={handleScrollToForm}
              className="inline-flex h-12 items-center gap-2 rounded-xl px-6 font-bold text-white transition hover:brightness-110 shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              Começar Inscrição
              <ArrowRight size={18} />
            </button>
            <div className="flex items-center gap-6 text-sm font-semibold text-slate-400">
              <span className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                Oficial
              </span>
              {hasWhatsappSupport && (
                <span className="flex items-center gap-2">
                  <MessageCircle size={18} className="text-emerald-400" />
                  Suporte WhatsApp
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white mb-5">
            <Search size={24} />
          </div>
          <h3 className="text-lg font-bold text-white">Já submeteu uma candidatura?</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Use o seu código de protocolo para ver o estado do processo ou enviar documentos pendentes.
          </p>
          <Link
            href={`/admissoes/${config.escola.slug}/consultar`}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-100 shadow-md"
          >
            Consultar Inscrição
          </Link>
        </div>
      </div>
    </section>
  );
}

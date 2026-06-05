"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import type { AdmissionConfig } from "../AdmissionForm";

export function CourseCatalog({
  config,
  onSelectTurma,
}: {
  config: AdmissionConfig;
  onSelectTurma: (turmaId: string) => void;
}) {
  const primaryColor = config.escola.cor_primaria || "#1F6B3B";
  const visibleTurmas = config.turmas;

  const disponibilidadeLabel: Record<NonNullable<AdmissionConfig["turmas"][number]["disponibilidade"]>, string> = {
    disponivel: "Disponível",
    ultimas_vagas: "Últimas vagas",
    lista_espera: "Lista de espera aberta",
  };

  const disponibilidadeStyle: Record<NonNullable<AdmissionConfig["turmas"][number]["disponibilidade"]>, string> = {
    disponivel: "bg-emerald-50 text-emerald-700 border-emerald-100",
    ultimas_vagas: "bg-amber-50 text-amber-700 border-amber-100",
    lista_espera: "bg-slate-100 text-slate-700 border-slate-200",
  };

  if (visibleTurmas.length === 0) return null;

  return (
    <section id="admissao-catalogo" className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Turmas e Cursos</p>
          <h2 className="text-2xl font-black text-slate-900 md:text-3xl mt-1">Selecione uma opção para iniciar</h2>
        </div>
        <p className="max-w-xs text-sm text-slate-500 sm:text-right">
          As vagas são limitadas e a escola avalia cada perfil antes de confirmar a matrícula definitiva.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleTurmas.map((turma) => {
          const disponibilidade = turma.disponibilidade ?? "disponivel";
          const curso = config.cursos.find((item) => item.id === turma.curso_id);
          const isWaitlist = disponibilidade === "lista_espera";

          return (
            <button
              key={turma.id}
              type="button"
              onClick={() => onSelectTurma(turma.id)}
              className="group flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md h-full"
            >
              <div className="w-full">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:scale-110 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <span className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${disponibilidadeStyle[disponibilidade]}`}>
                    {disponibilidadeLabel[disponibilidade]}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">{turma.nome}</h3>
                <p className="mt-2 text-sm text-slate-500 font-medium">{curso?.nome || "Curso"}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg w-fit">
                  <ClockIcon />
                  Turno: {turma.turno || "A confirmar"}
                </div>
              </div>

              <div className="mt-6 w-full pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-black transition-colors" style={{ color: primaryColor }}>
                {isWaitlist ? "Entrar na lista de espera" : "Inscrever nesta turma"}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 group-hover:bg-current transition-colors">
                  <ArrowRight size={16} className="text-current group-hover:text-white" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

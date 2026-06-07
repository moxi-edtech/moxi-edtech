"use client";

import { ArrowRight, BookOpen, Clock } from "lucide-react";
import type { AdmissionConfig } from "../AdmissionForm";

export function CourseCatalog({
  config,
  onSelectTurma,
}: {
  config: AdmissionConfig;
  onSelectTurma: (turmaId: string) => void;
}) {
  const primaryColor = config.escola.cor_primaria || "#1F6B3B";
  const coursesWithTurmas = config.cursos
    .map((curso) => ({
      ...curso,
      turmas: config.turmas.filter((turma) => turma.curso_id === curso.id),
    }))
    .filter((curso) => curso.turmas.length > 0);

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

  if (coursesWithTurmas.length === 0) return null;

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
        {coursesWithTurmas.map((curso) => {
          return (
            <article
              key={curso.id}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="w-full">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <BookOpen size={24} />
                  </div>
                  <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {curso.turmas.length} {curso.turmas.length === 1 ? "turma" : "turmas"}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">{curso.nome}</h3>
                <div className="mt-4 space-y-3">
                  {curso.turmas.map((turma) => {
                    const disponibilidade = turma.disponibilidade ?? "disponivel";
                    const isWaitlist = disponibilidade === "lista_espera";

                    return (
                      <div key={turma.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-slate-900">{turma.nome}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                              <Clock size={14} />
                              {turma.turno || "Turno a confirmar"}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${disponibilidadeStyle[disponibilidade]}`}>
                            {disponibilidadeLabel[disponibilidade]}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectTurma(turma.id)}
                          className="mt-3 flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-xs font-black transition hover:bg-slate-100"
                          style={{ color: primaryColor }}
                        >
                          {isWaitlist ? "Entrar na lista de espera" : "Inscrever nesta turma"}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

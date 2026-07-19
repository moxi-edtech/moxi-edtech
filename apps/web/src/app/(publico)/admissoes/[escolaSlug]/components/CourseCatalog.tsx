"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import type { AdmissionConfig } from "../AdmissionForm";
import { formatTurmaDisplayName } from "@/utils/formatters";

export function CourseCatalog({
  config,
  onSelectCourse,
}: {
  config: AdmissionConfig;
  onSelectCourse: (cursoId: string) => void;
}) {
  const primaryColor = config.escola.cor_primaria || "#1F6B3B";

  const coursesWithGrades = config.cursos
    .map((curso) => {
      const courseTurmas = config.turmas.filter((t) => t.curso_id === curso.id);

      // Group by Grade Name to show what grades are available in this course
      const gradesSet = new Set<string>();
      let hasAvailability = false;

      courseTurmas.forEach(t => {
        gradesSet.add(formatTurmaDisplayName(t));
        if (t.disponibilidade !== "lista_espera") {
          hasAvailability = true;
        }
      });

      const gradesList = Array.from(gradesSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

      return {
        ...curso,
        grades: gradesList,
        hasAvailability,
      };
    })
    .filter((curso) => curso.grades.length > 0);

  if (coursesWithGrades.length === 0) return null;

  return (
    <section id="admissao-catalogo" className="mx-auto max-w-6xl px-3 py-9 sm:px-4 sm:py-14">
      <div className="mb-6 flex flex-col gap-2 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700 sm:mb-3 sm:text-xs">Escolha primeiro</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">Níveis de ensino</h2>
        </div>
        <p className="max-w-sm text-sm font-medium leading-relaxed text-slate-600 sm:text-right">
          Selecione o curso desejado para iniciar o processo de candidatura.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {coursesWithGrades.map((curso) => {
          return (
            <article
              key={curso.id}
              className="group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-emerald-950/10 bg-white p-4 text-left shadow-[0_12px_32px_rgba(45,34,12,0.07)] transition-all hover:-translate-y-1 hover:border-emerald-900/20 hover:shadow-[0_28px_70px_rgba(15,76,49,0.14)] sm:rounded-[1.75rem] sm:p-7"
            >
              <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-amber-200/35 blur-2xl" />
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 transition-transform group-hover:scale-105 sm:mb-6 sm:h-14 sm:w-14 sm:rounded-2xl">
                <BookOpen className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>

              <h3 className="mb-3 text-lg font-black leading-tight tracking-tight text-slate-950 sm:mb-4 sm:text-2xl">
                {curso.nome}
              </h3>

              <div className="mb-4 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto sm:mb-8 sm:max-h-none sm:gap-2 sm:overflow-visible">
                {curso.grades.map((grade) => (
                  <span
                    key={grade}
                    className="rounded-full border border-emerald-950/10 bg-[#fff8ec] px-2.5 py-1 text-[10px] font-black text-emerald-800 sm:px-3 sm:py-1.5 sm:text-[11px]"
                  >
                    {grade}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={() => onSelectCourse(curso.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(15,76,49,0.16)] transition-all hover:brightness-110 active:scale-95 sm:rounded-2xl sm:px-6 sm:py-4"
                  style={{ backgroundColor: primaryColor }}
                >
                  {curso.hasAvailability ? "Candidatar-me" : "Entrar na lista de espera"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

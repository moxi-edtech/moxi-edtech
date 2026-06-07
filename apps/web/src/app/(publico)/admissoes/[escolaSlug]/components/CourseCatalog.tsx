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
    <section id="admissao-catalogo" className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-12">
        <div>
          <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Níveis de ensino</h2>
        </div>
        <p className="max-w-xs text-sm text-slate-500 sm:text-right">
          Selecione o curso desejado para iniciar o processo de candidatura.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {coursesWithGrades.map((curso) => {
          return (
            <article
              key={curso.id}
              className="group relative flex h-full flex-col rounded-[2.5rem] border border-slate-200 bg-white p-8 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-6 group-hover:scale-110 transition-transform">
                <BookOpen size={28} />
              </div>

              <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">
                {curso.nome}
              </h3>

              <div className="flex flex-wrap gap-2 mb-8">
                {curso.grades.map((grade) => (
                  <span
                    key={grade}
                    className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-slate-100"
                  >
                    {grade}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => onSelectCourse(curso.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black text-white shadow-lg transition-all active:scale-95 hover:opacity-90"
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

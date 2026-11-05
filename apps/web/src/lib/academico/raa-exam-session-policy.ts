import type { RegimeAcademico } from "./regime-academico";

/** Match the extraordinary-exam pathways already supported by the RAA engine. */
export function canScheduleRaaExam(
  regime: Pick<RegimeAcademico, "eh_classe_exame" | "exames_aplicaveis" | "classe_num" | "nivel_ensino" | "ano_numero">,
  type: "exame_nacional" | "recurso" | "extraordinario",
): boolean {
  return regime.eh_classe_exame || regime.exames_aplicaveis.includes(type) ||
    (type === "extraordinario" && ([7, 8, 10, 11].includes(regime.classe_num ?? -1) ||
      (regime.nivel_ensino === "eja" && regime.ano_numero === 1)));
}

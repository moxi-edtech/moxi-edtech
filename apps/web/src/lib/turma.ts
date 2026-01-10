import {
  removeAccents,
  normalizeCode,
  resolveCourseCode,
  parseTurmaCode,
  parseTurmaCodeParts,
  buildTurmaCode,
  findCursoIdByFuzzy,
  COURSE_CODE_ALIASES,
} from "./academico/turma-utils";

import type { CurriculumKey } from "@/lib/academico/curriculum-presets";
import type { ShiftCode as AcademicoShiftCode, ShiftLabel as AcademicoShiftLabel, TurmaCodeParts as AcademicoTurmaCodeParts, ParsedTurmaInfo as AcademicoParsedTurmaInfo } from "./academico/turma-utils";


// Export types from academico/turma-utils under their intended names
export type ShiftCode = AcademicoShiftCode;
export type ShiftLabel = AcademicoShiftLabel;
export type TurmaCodeParts = AcademicoTurmaCodeParts;
export type ParsedTurmaInfo = AcademicoParsedTurmaInfo;


// --- Local definitions moved from old academico/turma-utils ---
// These functions were previously in the old academico/turma-utils.ts
// Now defined here as they are still used by other files that import from lib/turma,
// but are not part of the new core academico/turma-utils refactor.

function normalizeShift(shift: string): ShiftCode {
  const s = removeAccents(shift).toUpperCase();
  const SHIFT_MAP: Record<string, ShiftCode> = {
    MANHA: "M",
    MATUTINO: "M",
    M: "M",
    TARDE: "T",
    VESPERTINO: "T",
    T: "T",
    NOITE: "N",
    NOTURNO: "N",
    N: "N",
  };
  const mapped = SHIFT_MAP[s];
  if (mapped) return mapped;
  if (s.startsWith("M")) return "M";
  if (s.startsWith("T")) return "T";
  if (s.startsWith("N")) return "N";
  return "M"; // Default to morning if invalid input.
}

export function formatarTurno(turno: string): string {
  const map: { [key: string]: string } = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
  return map[turno] || turno;
}

export const findClasseByNum = (num: string | null, listaClasses: any[]) => {
  if (!num || !listaClasses) return null;
  return listaClasses.find((c) => {
    const nomeNorm = removeAccents((c as any).nome || "");
    const match = nomeNorm.match(/(\d+)/);
    return match && match[1] === num;
  })?.id;
};

// --- Re-introduce normalizeTurmaCode ---
// This function was present in the old academico/turma-utils.ts and is still needed.
export function normalizeTurmaCode(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = parseTurmaCode(raw); // Use the new parseTurmaCode
    if (parsed.siglaCurso && parsed.classeNum && parsed.letraTurma) {
      // Ensure the generated code uses the RESOLVED sigla (TI) and not the original (INF)
      const courseCode = resolveCourseCode(parsed.siglaCurso);
      return `${courseCode}-${parsed.classeNum}-${parsed.turnoSigla}-${parsed.letraTurma}`.toUpperCase();
    }
  } catch {}

  // Fallback behavior, consistent with old normalizeTurmaCode
  return removeAccents(raw)
    .toUpperCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "");
}


// Re-export all values from academico/turma-utils that we want to expose through lib/turma
export {
  removeAccents,
  normalizeCode,
  resolveCourseCode,
  parseTurmaCode,
  parseTurmaCodeParts,
  buildTurmaCode,
  findCursoIdByFuzzy,
  COURSE_CODE_ALIASES,
};
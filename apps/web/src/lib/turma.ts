export {
  SHIFT_MAP,
  CURSO_MAP,
  TURMA_CODE_RE,
  removeAccents,
  normalizeCode,
  normalizeTurmaCode,
  buildTurmaCode,
  parseTurmaCode,
  parseTurmaCodeParts,
  gerarNomeTurma,
  formatarTurno,
  gerarSiglaCurso,
  findCursoIdByFuzzy,
  findClasseByNum,
} from "./academico/turma-utils";

export type {
  ShiftCode,
  ShiftLabel,
  TurmaCodeParts,
  ParsedTurmaInfo,
} from "./academico/turma-utils";

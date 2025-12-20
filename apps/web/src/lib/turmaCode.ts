export type ShiftCode = "M" | "T" | "N";

export type TurmaCodeParts = {
  code: string;
  courseCode: string;
  classNum: number;
  shift: ShiftCode;
  section: string;
};

const TURMA_CODE_RE = /^([A-Z0-9]{2,8})-(\d{1,2})-(M|T|N)-([A-Z]{1,2})$/;

export function normalizeTurmaCode(input: string): string {
  return (input ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function parseTurmaCode(input: string): TurmaCodeParts {
  const code = normalizeTurmaCode(input);
  const m = code.match(TURMA_CODE_RE);
  if (!m) {
    throw new Error(`Código da Turma inválido: "${input}". Ex: TI-10-M-A`);
  }

  const classNum = Number(m[2]);
  if (classNum < 1 || classNum > 13) {
    throw new Error(`Classe fora do intervalo (1-13): ${classNum}`);
  }

  return {
    code,
    courseCode: m[1],
    classNum,
    shift: m[3] as ShiftCode,
    section: m[4],
  };
}

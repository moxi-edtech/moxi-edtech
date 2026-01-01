import type { CurriculumKey } from "@/lib/academico/curriculum-presets";

export type ShiftCode = "M" | "T" | "N";
export type ShiftLabel = "Manhã" | "Tarde" | "Noite";

export interface ParsedTurmaInfo {
  siglaCurso: string | null;
  classeNum: string | null;
  turnoSigla: ShiftCode;
  letraTurma: string;
  nomeSugerido: string;
  cursoSugeridoNome: string | null;
  curriculumKey: CurriculumKey | null;
}

export type TurmaCodeParts = {
  code: string;
  courseCode: string;
  classNum: number;
  shift: ShiftCode;
  section: string;
};

const CURSO_MAP: Record<string, { nome: string; curriculumKey?: CurriculumKey; isStandard?: boolean }> = {
  TI: { nome: "Técnico de Informática", curriculumKey: "tecnico_informatica", isStandard: true },
  INF: { nome: "Técnico de Informática", curriculumKey: "tecnico_informatica" },
  TEC_INFO: { nome: "Técnico de Informática", curriculumKey: "tecnico_informatica" },

  TG: { nome: "Técnico de Gestão Empresarial", curriculumKey: "tecnico_gestao", isStandard: true },
  GES: { nome: "Técnico de Gestão Empresarial", curriculumKey: "tecnico_gestao" },

  CC: { nome: "Técnico de Construção Civil", curriculumKey: "tecnico_construcao", isStandard: true },
  CIV: { nome: "Técnico de Construção Civil", curriculumKey: "tecnico_construcao" },

  ENF: { nome: "Técnico de Enfermagem", curriculumKey: "saude_enfermagem", isStandard: true },
  SAU: { nome: "Técnico de Enfermagem", curriculumKey: "saude_enfermagem" },

  AN: { nome: "Análises Clínicas", curriculumKey: "saude_farmacia_analises", isStandard: true },
  FAR: { nome: "Farmácia", curriculumKey: "saude_farmacia_analises" },

  EP: { nome: "Ensino Primário", curriculumKey: "primario_avancado", isStandard: true },
  EB: { nome: "Ensino Básico", curriculumKey: "ciclo1" },
  PUNIV: { nome: "Ensino Pré-Universitário", curriculumKey: "puniv", isStandard: true },
  CFB: { nome: "Ciências Físico-Biológicas", curriculumKey: "puniv" },
  CEJ: { nome: "Ciências Económicas e Jurídicas", curriculumKey: "economicas" },
};

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

export const TURMA_CODE_RE = /^([A-Z0-9]{2,8})-(\d{1,2})-(M|T|N)-([A-Z]{1,2})$/;

export const removeAccents = (str: string) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export const normalizeCode = (str: string) => removeAccents(str).toLowerCase().replace(/[^a-z0-9]/g, "");

function normalizeShift(shift: string): ShiftCode {
  const s = removeAccents(shift).toUpperCase();
  const mapped = SHIFT_MAP[s];
  if (mapped) return mapped;
  if (s.startsWith("M")) return "M";
  if (s.startsWith("T")) return "T";
  if (s.startsWith("N")) return "N";
  throw new Error(`Turno inválido: "${shift}"`);
}

export function parseTurmaCode(input: string): ParsedTurmaInfo {
  const result: ParsedTurmaInfo = {
    siglaCurso: null,
    classeNum: null,
    turnoSigla: "M",
    letraTurma: "A",
    nomeSugerido: input,
    cursoSugeridoNome: null,
    curriculumKey: null,
  };

  if (!input) return result;

  const clean = removeAccents(input).toUpperCase();
  const rigidMatch = clean.match(/^([A-Z]{2,})\s*[-_]?\s*(\d{1,2})\s*[-_]?\s*([A-Z]{1,2})\s*[-_]?\s*([A-Z]?)$/);

  if (rigidMatch) {
    const [, sigla, classe, p3, p4] = rigidMatch;
    result.siglaCurso = sigla;
    result.classeNum = classe;

    const p3IsTurno = ["M", "T", "N"].includes(p3);
    const p4IsTurno = p4 && ["M", "T", "N"].includes(p4);

    if (p3IsTurno) {
      result.turnoSigla = p3 as ShiftCode;
      result.letraTurma = p4 || "A";
    } else if (p4IsTurno) {
      result.turnoSigla = p4 as ShiftCode;
      result.letraTurma = p3;
    } else {
      result.letraTurma = p3;
    }
  } else {
    const compactMatch = clean.replace(/[^A-Z0-9]/g, "").match(/^([A-Z]{2,})(\d{1,2})([MTN])?([A-Z])?$/);
    if (compactMatch) {
      result.siglaCurso = compactMatch[1];
      result.classeNum = compactMatch[2];
      result.turnoSigla = (compactMatch[3] as ShiftCode) || "M";
      result.letraTurma = compactMatch[4] || "A";
    }
  }

  if (result.siglaCurso) {
    const meta = CURSO_MAP[result.siglaCurso];
    if (meta) {
      result.cursoSugeridoNome = meta.nome;
      result.curriculumKey = meta.curriculumKey || null;
    } else {
      result.cursoSugeridoNome = result.siglaCurso;
    }
  }

  if (result.classeNum) {
    const num = parseInt(result.classeNum, 10);
    if (!result.curriculumKey && !Number.isNaN(num)) {
      if (num <= 6) result.curriculumKey = "primario_base";
      else if (num <= 9) result.curriculumKey = "ciclo1";
    }
  }

  result.nomeSugerido = `${result.classeNum || "?"}ª Classe ${result.letraTurma}`;
  return result;
}

export function parseTurmaCodeParts(input: string): TurmaCodeParts {
  const info = parseTurmaCode(input);
  if (!info.siglaCurso || !info.classeNum || !info.letraTurma) {
    throw new Error(`Código da Turma inválido: "${input}". Ex: TI-10-M-A`);
  }

  const classNum = Number(info.classeNum);
  if (classNum < 1 || classNum > 13) {
    throw new Error(`Classe fora do intervalo (1-13): ${info.classeNum}`);
  }

  const section = info.letraTurma;
  const code = `${info.siglaCurso}-${classNum}-${info.turnoSigla}-${section}`;

  return {
    code,
    courseCode: info.siglaCurso,
    classNum,
    shift: info.turnoSigla,
    section,
  };
}

export function normalizeTurmaCode(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = parseTurmaCode(raw);
    if (parsed.siglaCurso && parsed.classeNum && parsed.letraTurma) {
      return `${parsed.siglaCurso}-${parsed.classeNum}-${parsed.turnoSigla}-${parsed.letraTurma}`.toUpperCase();
    }
  } catch {}

  return removeAccents(raw)
    .toUpperCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "");
}

export function buildTurmaCode(params: {
  courseCode: string;
  classNum: number | string;
  shift: ShiftCode | string;
  section: string;
}): string {
  const courseCode = removeAccents(params.courseCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const classNum = Number(params.classNum);
  const shift = normalizeShift(params.shift as string);
  const section = removeAccents(params.section).toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!courseCode) throw new Error("Código do curso é obrigatório");
  if (!Number.isInteger(classNum) || classNum < 1 || classNum > 13) {
    throw new Error(`Classe fora do intervalo (1-13): ${params.classNum}`);
  }
  if (!section) throw new Error("Letra da turma é obrigatória");

  return `${courseCode}-${classNum}-${shift}-${section}`;
}

export function gerarNomeTurma(
  cursoNome: string,
  classeNome: string,
  turno: string,
  letraOuSequencia: string | number,
  padrao: "descritivo" | "tecnico" | "compacto" = "descritivo",
  anoLetivo?: number | string
): string {
  const ano = anoLetivo ? `(${anoLetivo})` : "";
  const turnoCode = normalizeShift(turno);
  const turnoLabel: ShiftLabel = turnoCode === "M" ? "Manhã" : turnoCode === "T" ? "Tarde" : "Noite";
  const classeLimpa = `${classeNome.replace(/\D/g, "")}ª`;
  const identificador = typeof letraOuSequencia === "number" && letraOuSequencia > 0
    ? `Turma ${letraOuSequencia}`
    : String(letraOuSequencia);

  let sigla = normalizeCode(cursoNome).substring(0, 3).toUpperCase();
  const entry = Object.entries(CURSO_MAP).find(([, val]) => val.isStandard && normalizeCode(val.nome) === normalizeCode(cursoNome));
  if (entry) sigla = entry[0];

  switch (padrao) {
    case "descritivo":
      return `${cursoNome} ${classeLimpa} ${identificador} ${ano}`.trim();
    case "tecnico":
      return `${sigla} - ${classeLimpa} ${identificador} - ${turnoLabel}`;
    case "compacto":
      return `${sigla}-${classeLimpa.replace("ª", "")}-${turnoCode}-${identificador.replace("Turma ", "")}`;
    default:
      return `${cursoNome} ${classeLimpa}`;
  }
}

export function formatarTurno(turno: string): string {
  const map: { [key: string]: string } = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
  return map[turno] || turno;
}

export function gerarSiglaCurso(cursoNome: string): string {
  return cursoNome
    .split(" ")
    .map((palavra) => palavra[0])
    .join("")
    .toUpperCase();
}

export const findCursoIdByFuzzy = (info: ParsedTurmaInfo, listaCursosDB: any[]) => {
  if (!listaCursosDB || !info.siglaCurso) return null;

  const termoBusca = normalizeCode(info.siglaCurso);
  const nomeSugeridoNorm = info.cursoSugeridoNome ? normalizeCode(info.cursoSugeridoNome) : "";

  return (
    listaCursosDB.find((c) => {
      const dbSigla = normalizeCode((c as any).sigla || (c as any).codigo || "");
      const dbNome = normalizeCode((c as any).nome || "");
      const dbKey = ((c as any).curriculum_key || "").toLowerCase();

      if (info.curriculumKey && dbKey === info.curriculumKey) return true;
      if (dbSigla === termoBusca) return true;
      if (nomeSugeridoNorm && dbNome.includes(nomeSugeridoNorm)) return true;
      return false;
    })?.id || null
  );
};

export const findClasseByNum = (num: string | null, listaClasses: any[]) => {
  if (!num || !listaClasses) return null;
  return listaClasses.find((c) => {
    const nomeNorm = removeAccents((c as any).nome || "");
    const match = nomeNorm.match(/(\d+)/);
    return match && match[1] === num;
  })?.id;
};

export { CURSO_MAP, SHIFT_MAP };

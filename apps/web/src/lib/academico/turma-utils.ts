import {
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/academico/curriculum-presets";

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

// =========================================================
// SSOT: Single Source of Truth baseada nos Presets Oficiais
// =========================================================

// Cria um mapa reverso: SIGLA (ex: "TI") -> { Key, Nome }
// Ex: "TI" -> { key: "tec_informatica_gestao", nome: "Técnico de Informática de Gestão" }
const OFFICIAL_BY_CODE = new Map<string, { curriculumKey: CurriculumKey; nome: string }>(
  (Object.keys(CURRICULUM_PRESETS_META) as CurriculumKey[]).map((key) => {
    const meta = CURRICULUM_PRESETS_META[key];
    return [meta.course_code.toUpperCase(), { curriculumKey: key, nome: meta.label }];
  })
);

/**
 * Aliases de Compatibilidade (UX / Legado).
 * O usuário digita "INF", nós convertemos para "TI".
 * O usuário digita "PUNIV", nós convertemos para "CFB" (assumindo padrão).
 */
const COURSE_CODE_ALIASES: Record<string, string> = {
  INF: "TI",
  TEC_INFO: "TIG",
  GES: "TG",
  SAU: "ENF",
  FAR: "FARM",
  EST: "ESTO",
  FIS: "FISI",
  NUT: "NUTR",
  AC: "ACL",
  CIV: "CC",
  CONST: "CC",
  ELEC: "EL",
  ELETR: "EL",
  MEC: "MEC",
  MECA: "MEC",
  TIS: "TIS",
  DP: "DP",
  ET: "ET",
  EA: "EA",
  ER: "ER",
  GP: "GP",
  PP: "PP",
  MIN: "MIN",
  PM: "PM",
  TIH: "TI",
  TGS: "TGS",
  EB: "ESG",
  PUNIV: "CFB", // Convenção comum
  // Adicione outros aliases regionais se necessário
};

// ---------------------------------------------------------
// Helpers de Limpeza e Resolução
// ---------------------------------------------------------

export const removeAccents = (str: string) => 
  (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export const normalizeCode = (str: string) => 
  removeAccents(str).toLowerCase().replace(/[^a-z0-9]/g, "");

// Resolve o código final (SSOT). Ex: "INF" -> "TI". "TI" -> "TI".
export function resolveCourseCode(raw: string): string {
  if (!raw) return "";
  // 1. Limpa sujeira (traços, espaços, acentos)
  const code = removeAccents(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  // 2. Aplica Alias ou retorna o próprio
  return (COURSE_CODE_ALIASES[code] || code).toUpperCase();
}

function normalizeShift(shift: string): ShiftCode {
  const s = removeAccents(shift).toUpperCase();
  const SHIFT_MAP: Record<string, ShiftCode> = {
    MANHA: "M", MATUTINO: "M", M: "M",
    TARDE: "T", VESPERTINO: "T", T: "T",
    NOITE: "N", NOTURNO: "N", N: "N",
  };
  return SHIFT_MAP[s] || "M"; // Fallback seguro para Manhã se inválido? Ou erro?
}

// ---------------------------------------------------------
// Parse e Build
// ---------------------------------------------------------

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
  // Regex flexível: aceita TI-10-M-A, TI 10 M A, TI_10_M_A
  const rigidMatch = clean.match(/^([A-Z]{2,})\s*[-_]?\s*(\d{1,2})\s*[-_]?\s*([A-Z]{1,2})\s*[-_]?\s*([A-Z]?)$/);

  if (rigidMatch) {
    const [, sigla, classe, p3, p4] = rigidMatch;
    result.siglaCurso = sigla;
    result.classeNum = classe;

    // Detecta turno (M/T/N) na posição 3 ou 4
    const p3IsTurno = ["M", "T", "N"].includes(p3);
    const p4IsTurno = p4 && ["M", "T", "N"].includes(p4);

    if (p3IsTurno) {
      result.turnoSigla = p3 as ShiftCode;
      result.letraTurma = p4 || "A";
    } else if (p4IsTurno) {
      result.turnoSigla = p4 as ShiftCode;
      result.letraTurma = p3;
    } else {
      // Assumimos que p3 é a letra se não for turno
      result.letraTurma = p3;
    }
  } else {
    // Regex Compacto: TI10MA
    const compactMatch = clean.replace(/[^A-Z0-9]/g, "").match(/^([A-Z]{2,})(\d{1,2})([MTN])?([A-Z])?$/);
    if (compactMatch) {
      result.siglaCurso = compactMatch[1];
      result.classeNum = compactMatch[2];
      result.turnoSigla = (compactMatch[3] as ShiftCode) || "M";
      result.letraTurma = compactMatch[4] || "A";
    }
  }

  // --- LÓGICA DE RESOLUÇÃO (SSOT) ---
  if (result.siglaCurso) {
    // 1. Resolve Aliases (INF -> TI)
    const resolved = resolveCourseCode(result.siglaCurso);
    result.siglaCurso = resolved;

    // 2. Busca na Tabela Oficial
    const official = OFFICIAL_BY_CODE.get(resolved);
    if (official) {
      result.cursoSugeridoNome = official.nome;
      result.curriculumKey = official.curriculumKey;
    } else {
      // Curso desconhecido (mas validamente parseado). Ex: "ROB" (Robótica - não oficial)
      // O sistema vai criar um stub com course_code="ROB"
      result.cursoSugeridoNome = resolved;
      result.curriculumKey = null;
    }
  }

  // Lógica de inferência para primário baseada apenas no número da classe (se o curso não for explícito ou for genérico)
  if (result.classeNum && !result.curriculumKey) {
    const num = parseInt(result.classeNum, 10);
    if (!Number.isNaN(num)) {
      if (num <= 6) result.curriculumKey = "primario_generico"; // Assunção segura para 1-6
      // Para 7-9 não assumimos ESG direto pois pode ser música/dança, etc.
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

  // Garante que o código gerado usa a sigla RESOLVIDA (TI) e não a original (INF)
  const courseCode = resolveCourseCode(info.siglaCurso);
  const section = info.letraTurma;
  const code = `${courseCode}-${classNum}-${info.turnoSigla}-${section}`;

  return {
    code,
    courseCode,
    classNum,
    shift: info.turnoSigla,
    section,
  };
}

export function buildTurmaCode(params: {
  courseCode: string;
  classNum: number | string;
  shift: ShiftCode | string;
  section: string;
}): string {
  // Resolve também aqui para garantir consistência na criação manual
  const courseCode = resolveCourseCode(params.courseCode);
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

// ---------------------------------------------------------
// Helpers de Busca DB (Refatorado para course_code)
// ---------------------------------------------------------

type CursoRow = {
  id: string;
  course_code?: string | null;
  curriculum_key?: string | null;
};

export const findCursoIdByFuzzy = (info: ParsedTurmaInfo, listaCursosDB: CursoRow[]) => {
  if (!listaCursosDB || !info.siglaCurso) return null;

  // O que estamos procurando? A sigla resolvida (ex: TI)
  const wanted = resolveCourseCode(info.siglaCurso);

  return (
    listaCursosDB.find((c) => {
      // 1. Comparação Direta: course_code do banco vs Sigla Resolvida
      // O banco deve ter 'TI'. Wanted é 'TI'.
      const dbCourseCode = normalizeCode(c.course_code || "");
      if (dbCourseCode && dbCourseCode === normalizeCode(wanted)) return true;

      // 2. Comparação de Segurança: curriculum_key
      // Se o parser identificou que é 'tec_informatica_gestao', e o banco tem essa key, é match.
      // Isso protege caso o course_code no banco esteja errado mas a key certa.
      const dbKey = (c.curriculum_key || "").toLowerCase();
      if (info.curriculumKey && dbKey === info.curriculumKey) return true;

      return false;
    })?.id || null
  );
};

// ... (Outros helpers de formatação mantêm iguais)
export { COURSE_CODE_ALIASES }; // Exporta aliases para debug, mas não o mapa antigo

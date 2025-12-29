import type { CurriculumKey } from "@/lib/academico/curriculum-presets";

// apps/web/src/utils/turmaParser.ts

// 1. Função para limpar acentos (A Bala de Prata)
const removeAccents = (str: string) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const normalizeCode = (str: string) => removeAccents(str).replace(/[^a-z0-9]/g, "");

// 2. Mapeamento Expandido (Adicione todas as siglas possíveis aqui)
const CURSO_MAP: Record<string, { nome: string; curriculumKey?: CurriculumKey }> = {
  // Técnicos
  TI: { nome: "Técnico de Informática", curriculumKey: "tecnico_informatica" },
  INF: { nome: "Técnico de Informática", curriculumKey: "tecnico_informatica" },
  TEC_INFO: { nome: "Técnico de Informática", curriculumKey: "tecnico_informatica" },
  TECNICO_INFORMATICA: { nome: "Técnico de Informática", curriculumKey: "tecnico_informatica" },

  TG: { nome: "Técnico de Gestão", curriculumKey: "tecnico_gestao" },
  GES: { nome: "Técnico de Gestão", curriculumKey: "tecnico_gestao" },
  TEC_GEST: { nome: "Técnico de Gestão", curriculumKey: "tecnico_gestao" },
  TECNICO_GESTAO: { nome: "Técnico de Gestão", curriculumKey: "tecnico_gestao" },

  CC: { nome: "Técnico de Construção Civil", curriculumKey: "tecnico_construcao" },
  CIV: { nome: "Técnico de Construção Civil", curriculumKey: "tecnico_construcao" },
  TECNICO_CONSTRUCAO: { nome: "Técnico de Construção Civil", curriculumKey: "tecnico_construcao" },
  TECNICO_BASE: { nome: "Técnico Base", curriculumKey: "tecnico_base" },

  ENF: { nome: "Técnico de Enfermagem", curriculumKey: "saude_enfermagem" },
  SAU: { nome: "Técnico de Enfermagem", curriculumKey: "saude_enfermagem" },
  SAUDE_ENFERMAGEM: { nome: "Técnico de Enfermagem", curriculumKey: "saude_enfermagem" },

  FAR: { nome: "Técnico de Análises Clínicas", curriculumKey: "saude_farmacia_analises" },
  ANALISES: { nome: "Técnico de Análises Clínicas", curriculumKey: "saude_farmacia_analises" },
  SAUDE_FARMACIA_ANALISES: { nome: "Farmácia / Análises Clínicas", curriculumKey: "saude_farmacia_analises" },

  // Ensino Geral / Primário
  EP: { nome: "Ensino Primário", curriculumKey: "primario_avancado" },
  EPB: { nome: "Ensino Primário", curriculumKey: "primario_base" },
  EPA: { nome: "Ensino Primário", curriculumKey: "primario_avancado" },
  EB: { nome: "Ensino Básico", curriculumKey: "ciclo1" },
  EG: { nome: "Ensino Geral", curriculumKey: "ciclo1" },
  PRIMARIO_BASE: { nome: "Ensino Primário", curriculumKey: "primario_base" },
  PRIMARIO_AVANCADO: { nome: "Ensino Primário", curriculumKey: "primario_avancado" },
  CICLO1: { nome: "Ensino Básico", curriculumKey: "ciclo1" },

  // Pré-universitário
  CFB: { nome: "Ciências Físico-Biológicas", curriculumKey: "puniv" },
  CEJ: { nome: "Ciências Económicas e Jurídicas", curriculumKey: "economicas" },
  PUNIV: { nome: "Ensino Pré-Universitário", curriculumKey: "puniv" },
  ECONOMICAS: { nome: "Ciências Económicas e Jurídicas", curriculumKey: "economicas" },
};

export type ParsedTurmaInfo = {
  siglaCurso: string | null;
  classeNum: string | null;
  turnoSigla: string | null;
  letraTurma: string | null;
  nomeSugerido: string;
  cursoSugeridoNome: string | null;
  curriculumKey: CurriculumKey | null;
};

export const parseTurmaCode = (codigo: string): ParsedTurmaInfo => {
  if (!codigo)
    return {
      siglaCurso: null,
      classeNum: null,
      turnoSigla: null,
      letraTurma: null,
      nomeSugerido: "",
      cursoSugeridoNome: null,
      curriculumKey: null,
    };

  // Limpeza agressiva: Tira espaços e underscores extras
  const cleanCode = codigo.toUpperCase().replace(/\s+/g, "").trim();
  // Aceita separadores: Hífen (-), Underline (_) ou Barra (/)
  const parts = cleanCode.split(/[-_/]/).filter(Boolean);

  const buildResponse = (sigla: string | null, classe: string | null, turnoRaw?: string | null, letraRaw?: string | null) => {
    const turno = turnoRaw || "M";
    const letra = letraRaw || "A";
    const cursoMeta = sigla ? CURSO_MAP[sigla] : undefined;
    const classeNumInt = classe ? Number(String(classe).replace(/\D/g, "")) : NaN;

    let cursoNome = cursoMeta?.nome || null;
    let curriculumKey: CurriculumKey | null = cursoMeta?.curriculumKey || null;

    // Se não achou no mapa, usa a própria sigla como dica de busca
    if (!cursoNome && sigla && sigla.length > 2) {
      cursoNome = sigla;
    }

    // Inferência adicional pelo número da classe (ajuda cursos de base/onboarding)
    if (!curriculumKey && !Number.isNaN(classeNumInt)) {
      if (classeNumInt <= 6) curriculumKey = "primario_base";
      else if (classeNumInt <= 9) curriculumKey = "ciclo1";
    }

    return {
      siglaCurso: sigla,
      classeNum: classe ? String(classe).replace(/\D/g, "") || classe : null,
      turnoSigla: turno,
      letraTurma: letra,
      nomeSugerido: `${classe || ""}ª Classe ${letra}`.trim(),
      cursoSugeridoNome: cursoNome,
      curriculumKey,
    } as ParsedTurmaInfo;
  };

  // Caso clássico com separadores
  if (parts.length >= 2) {
    const sigla = parts[0];
    const classe = parts[1]; // Ex: "10"
    // Tenta achar o turno e letra (pode variar a posição)
    const part3 = parts[2] || "M";
    const part4 = parts[3] || "A";

    const turno = ["M", "T", "N"].includes(part3)
      ? part3
      : ["M", "T", "N"].includes(part4)
        ? part4
        : "M";

    const letra = part3.length === 1 && !["M", "T", "N"].includes(part3) ? part3 : part4;

    return buildResponse(sigla, classe, turno, letra);
  }

  // Fallback para códigos compactos: "TG10M", "TG10A" ou "TG10"
  const compact = cleanCode.replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^([A-Z]{2,})(\d{1,2})([MTN]?)([A-Z]?)$/);
  if (match) {
    const [, sigla, classe, turno, letra] = match;
    return buildResponse(sigla, classe, turno || undefined, letra || undefined);
  }

  // Fallback final: devolve dados mínimos
  return {
    siglaCurso: null,
    classeNum: null,
    turnoSigla: null,
    letraTurma: null,
    nomeSugerido: codigo,
    cursoSugeridoNome: null,
    curriculumKey: null,
  };
};

export const findCursoBySigla = (info: ParsedTurmaInfo, listaCursos: any[]) => {
    if (!listaCursos || !info.siglaCurso) return null;

    const siglaBusca = removeAccents(info.siglaCurso);

    // 0. Match pelo curriculum_key ou pelo próprio codigo armazenado como presetKey
    if (info.curriculumKey) {
      const matchCurriculum = listaCursos.find((c) => {
        const curr = (c.curriculum_key || "").toLowerCase();
        const codigoNorm = normalizeCode(c.codigo || "");
        return curr === info.curriculumKey || codigoNorm === normalizeCode(info.curriculumKey);
      });
      if (matchCurriculum) return matchCurriculum.id;
    }

    // 1. Match Exato de Códigos (Course Code ou Codigo do Banco)
    const matchCode = listaCursos.find(c => {
        const codeA = normalizeCode(c.course_code || '');
        const codeB = normalizeCode(c.codigo || '');
        return codeA === normalizeCode(info.siglaCurso) || codeB === normalizeCode(info.siglaCurso);
    });
    if (matchCode) return matchCode.id;

    // 2. Match Semântico (Nome do Curso vs Sugestão)
    if (info.cursoSugeridoNome) {
        const termoBusca = removeAccents(info.cursoSugeridoNome); // ex: "gestao"
        
        return listaCursos.find(c => {
            const nomeBanco = removeAccents(c.nome || ''); // ex: "tecnico de gestao"
            // Verifica se contém (search fuzzy)
            return nomeBanco.includes(termoBusca) || termoBusca.includes(nomeBanco);
        })?.id;
    }

    return null;
};

export const findClasseByNum = (num: string | null, listaClasses: any[]) => {
    if (!num || !listaClasses) return null;

    // Busca Exata do Número (Evita que "1" case com "12")
    // Procura o número isolado no nome da classe
    return listaClasses.find(c => {
        const nomeNorm = removeAccents(c.nome || '');
        // Regex: Encontra número seguido de 'a' ou espaço ou fim
        // Ex: "10a classe" -> match 10
        const match = nomeNorm.match(/(\d+)/);
        return match && match[1] === num;
    })?.id;
};

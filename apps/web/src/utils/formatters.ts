type TurmaDisplayInput = {
  nome?: string | null;
  turma_nome?: string | null;
  turno?: string | null;
  turma_turno?: string | null;
};

type AnoLetivoDisplayInput = {
  ano?: number | string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

const TURMA_TURNO_LABELS: Record<string, string> = {
  M: "Manhã",
  MANHA: "Manhã",
  MANHÃ: "Manhã",
  MATUTINO: "Manhã",
  T: "Tarde",
  TARDE: "Tarde",
  VESPERTINO: "Tarde",
  N: "Noite",
  NOITE: "Noite",
  NOTURNO: "Noite",
};

const cleanTurmaToken = (value: string) =>
  value
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isInternalTurmaPrefix = (value: string) => /^[A-Z0-9]{2,6}$/.test(value);

const joinTurmaLevelTokens = (tokens: string[]) =>
  tokens
    .filter(Boolean)
    .join("-")
    .replace(/\s*-\s*/g, "-")
    .trim();

const normalizeTurmaLevelName = (value: string) => {
  const cleaned = cleanTurmaToken(value);
  const numericClass = cleaned.match(/^(\d{1,2})$/);
  if (numericClass) return `${numericClass[1]}ª Classe`;
  return cleaned;
};

const inferTurnoFromTurmaName = (nome?: string | null) => {
  const rawParts = cleanTurmaToken(nome ?? "")
    .split("-")
    .map(cleanTurmaToken)
    .filter(Boolean);

  return rawParts.length >= 4 ? formatTurnoDisplay(rawParts[rawParts.length - 2]) : "";
};

export const formatTurnoDisplay = (turno?: string | null) => {
  const cleaned = cleanTurmaToken(turno ?? "").replace(/[().-]/g, "").toUpperCase();
  return TURMA_TURNO_LABELS[cleaned] ?? cleanTurmaToken(turno ?? "");
};

export const formatAnoLetivoDisplay = (anoLetivo?: AnoLetivoDisplayInput | number | string | null) => {
  const input =
    typeof anoLetivo === "object" && anoLetivo !== null
      ? anoLetivo
      : { ano: anoLetivo };

  const startFromDate = input.data_inicio ? new Date(input.data_inicio).getFullYear() : null;
  const endFromDate = input.data_fim ? new Date(input.data_fim).getFullYear() : null;

  if (Number.isFinite(startFromDate) && Number.isFinite(endFromDate) && startFromDate && endFromDate) {
    return `${startFromDate}/${endFromDate}`;
  }

  const startYear = Number(input.ano);
  if (!Number.isFinite(startYear)) return "—";

  return `${Math.trunc(startYear)}/${Math.trunc(startYear) + 1}`;
};

export const formatTurmaDisplayName = (turma: TurmaDisplayInput) => {
  const originalName = cleanTurmaToken(turma.nome ?? turma.turma_nome ?? "");
  if (!originalName) return "Sem turma";

  const providedTurnoLabel = formatTurnoDisplay(turma.turno ?? turma.turma_turno);
  const rawParts = originalName
    .split("-")
    .map(cleanTurmaToken)
    .filter(Boolean);

  // Exemplo de código técnico de 4 partes: PRE-Pré-Escolar-M-A, ESG-7ª Classe-T-B, TI-10ª Classe-M-A, ENF-10ª Classe-M-A
  if (rawParts.length >= 4) {
    const possibleTurno = TURMA_TURNO_LABELS[rawParts[rawParts.length - 2].toUpperCase()];
    if (possibleTurno) {
      const prefix = rawParts[0].toUpperCase();
      const levelPart = normalizeTurmaLevelName(rawParts.slice(1, -2).join("-"));
      const turmaLetra = rawParts[rawParts.length - 1];
      const finalTurno = providedTurnoLabel || possibleTurno;
      const turnoSuffix = finalTurno ? ` (${finalTurno})` : "";

      // Ignora siglas padrão de nível de ensino (PRE, EP, ESG) na exibição abreviada para manter foco na classe
      if (["PRE", "EP", "ESG"].includes(prefix)) {
        return `${levelPart} — Turma ${turmaLetra}${turnoSuffix}`;
      } else {
        // Cursos do Ensino Médio / Técnico (ex: TI, TG, ENF, AC, CONT, ELT, etc.)
        const cursoSiglaOrNome = TURMA_CURSO_LABELS[prefix] ?? prefix;
        return `${cursoSiglaOrNome} — ${levelPart} — Turma ${turmaLetra}${turnoSuffix}`;
      }
    }
  }

  const embeddedTurnoLabel = rawParts.length >= 4 ? formatTurnoDisplay(rawParts[rawParts.length - 2]) : "";
  const turnoLabel = providedTurnoLabel || embeddedTurnoLabel;

  if (rawParts.length >= 4 && formatTurnoDisplay(rawParts[rawParts.length - 2]) === turnoLabel) {
    const turmaPart = rawParts[rawParts.length - 1];
    const levelTokens = rawParts.slice(0, -2);
    if (levelTokens.length > 1 && isInternalTurmaPrefix(levelTokens[0])) levelTokens.shift();

    const levelName = normalizeTurmaLevelName(joinTurmaLevelTokens(levelTokens));
    if (levelName && turmaPart) return `${levelName} — Turma ${turmaPart}${turnoLabel ? ` (${turnoLabel})` : ""}`;
  }

  const classMatch = originalName.match(/(\d{1,2}\s*[ªº]?\s*Classe)/i);
  if (classMatch?.index == null) return originalName;

  const className = cleanTurmaToken(classMatch[1].replace(/\s+/g, " "));
  const suffix = originalName.slice(classMatch.index + classMatch[0].length);
  const parts = suffix
    .split("-")
    .map(cleanTurmaToken)
    .filter(Boolean)
    .filter((part) => formatTurnoDisplay(part) !== turnoLabel);

  const turmaPart = parts.find((part) => /^turma\s+/i.test(part)) ?? parts[0];
  if (!turmaPart) return className;

  const publicTurmaPart = /^turma\s+/i.test(turmaPart) ? turmaPart : `Turma ${turmaPart}`;
  return `${className} — ${publicTurmaPart}${turnoLabel ? ` (${turnoLabel})` : ""}`;
};

export const formatTurmaOptionDisplay = (
  turma: TurmaDisplayInput,
  disponibilidadeLabel?: string
) => {
  const parts = [
    formatTurmaDisplayName(turma),
    disponibilidadeLabel,
  ].filter(Boolean);

  return parts.join(" - ");
};

export const formatTurmaName = (turma: any, includeCourse = false) => {
  const shortClasse = turma?.classes?.nome
    ? String(turma.classes.nome).replace(' Classe', '')
    : '';

  const nome = turma?.nome ?? '';
  const turno = turma?.turno ?? '';

  let base = `${shortClasse ? `${shortClasse} ` : ''}${nome}${turno ? ` (${turno})` : ''}`.trim();

  if (includeCourse && turma?.cursos?.nome && turma?.cursos?.tipo === 'tecnico') {
    const cursoLabel = turma.cursos.codigo?.toUpperCase() || turma.cursos.nome;
    base = `${shortClasse ? `${shortClasse} ` : ''}${nome} (${cursoLabel})${turno ? ` - ${turno}` : ''}`.trim();
  }

  return base;
};

const TURMA_CURSO_LABELS: Record<string, string> = {
  TI: "Téc. Informática",
  CFB: "Ciências Físicas e Bio.",
  EP: "Ens. Primário",
  ESG: "Ens. Secundário Geral",
  TG: "Téc. Gestão",
  ENF: "Enfermagem",
  AC: "Análises Clínicas",
  CONT: "Contabilidade",
  FIN: "Finanças",
  ELT: "Electrónica",
  MEC: "Mecânica",
  DIR: "Direito",
  ECO: "Economia",
  CJ: "Ciências Jurídicas e Económicas",
};

export const formatTurmaNomeHumano = (raw?: string | null, cursoNome?: string | null) => {
  if (!raw) return "Sem nome";
  return formatTurmaDisplayName({ nome: raw });
};

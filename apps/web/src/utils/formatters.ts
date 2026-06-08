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
  const embeddedTurnoLabel = rawParts.length >= 4 ? formatTurnoDisplay(rawParts[rawParts.length - 2]) : "";
  const turnoLabel = providedTurnoLabel || embeddedTurnoLabel;

  if (rawParts.length >= 4 && formatTurnoDisplay(rawParts[rawParts.length - 2]) === turnoLabel) {
    const turmaPart = rawParts[rawParts.length - 1];
    const levelTokens = rawParts.slice(0, -2);
    if (levelTokens.length > 1 && isInternalTurmaPrefix(levelTokens[0])) levelTokens.shift();

    const levelName = normalizeTurmaLevelName(joinTurmaLevelTokens(levelTokens));
    if (levelName && turmaPart) return `${levelName} - Turma ${turmaPart}`;
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
  return `${className} - ${publicTurmaPart}`;
};

export const formatTurmaOptionDisplay = (
  turma: TurmaDisplayInput,
  disponibilidadeLabel?: string
) => {
  const parts = [
    formatTurmaDisplayName(turma),
    formatTurnoDisplay(turma.turno ?? turma.turma_turno) || inferTurnoFromTurmaName(turma.nome ?? turma.turma_nome),
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
  CFB: "Ciências Fís.Bio.",
  EP: "Ens. Primário",
  ESG: "Ens. Sec. Geral",
  TG: "Téc. Gestão",
};

export const formatTurmaNomeHumano = (raw?: string | null, cursoNome?: string | null) => {
  if (!raw) return "Sem nome";
  const displayName = formatTurmaDisplayName({ nome: raw });
  if (displayName !== raw) return displayName;

  const match = raw.trim().match(/^([A-Z]{2,4})-(\d{1,2})-([MTN])-(\w)$/i);
  if (!match) return raw;

  const [, siglaRaw, anoRaw, turnoRaw, letraRaw] = match;
  const sigla = siglaRaw.toUpperCase();
  const curso = TURMA_CURSO_LABELS[sigla] ?? cursoNome?.trim();
  if (!curso) return raw;

  const anoNum = Number(anoRaw);
  if (Number.isNaN(anoNum)) return raw;

  const turno = TURMA_TURNO_LABELS[turnoRaw.toUpperCase()];
  if (!turno) return raw;

  const letra = letraRaw.toUpperCase();

  return `${curso} · ${anoNum}ª · ${turno} · Turma ${letra}`;
};

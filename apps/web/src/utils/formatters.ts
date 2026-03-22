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

const TURMA_TURNO_LABELS: Record<string, string> = {
  M: "Manhã",
  T: "Tarde",
  N: "Noite",
};

export const formatTurmaNomeHumano = (raw?: string | null, cursoNome?: string | null) => {
  if (!raw) return "Sem nome";
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

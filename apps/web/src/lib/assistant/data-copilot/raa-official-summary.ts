import type { RaaProgressionDecision } from "@/lib/academico/raa-progression";

/** These are outputs of the official RAA resolver, not a model risk score. */
export type RaaEnrollmentDecision = {
  matriculaId: string;
  alunoId: string;
  turmaId: string;
  decision: RaaProgressionDecision;
};

export type RaaClassStatus = {
  turmaId: string;
  total: number;
  retenidos: number;
  retidosPorAproveitamento: number;
  retidosPorFaltas: number;
  retidosPorIndisciplina: number;
  pendentes: number;
  emRecurso: number;
  inscricaoCondicional: number;
  transitaram: number;
  concluiram: number;
};

const DECISIONS = new Set<RaaProgressionDecision>([
  "retido", "retido_por_faltas", "retido_por_indisciplina",
  "pendente", "recurso", "inscricao_condicional", "transitou", "concluiu",
]);

/**
 * Aggregate only decisions actually returned by the canonical resolver.
 * Never predict a student's final result from a grade, heuristic or LLM.
 * Fail closed on missing, duplicated, cross-class or incomplete coverage.
 */
export function summarizeOfficialRaaByTurma(
  enrollmentScope: ReadonlyArray<{ matriculaId: string; alunoId: string; turmaId: string }>,
  results: ReadonlyArray<RaaEnrollmentDecision>,
): { ok: true; classes: RaaClassStatus[]; source: "resolveRaaProgressionForMatricula" } |
   { ok: false; reason: string } {
  if (!enrollmentScope.length) return { ok: false, reason: "Não há matrículas no âmbito solicitado; não é possível classificar turmas." };
  const idSet = new Set<string>();
  const studentSet = new Set<string>();
  const expected = new Map<string, { matriculaId: string; alunoId: string; turmaId: string }>();
  for (const enrollment of enrollmentScope) {
    if (!enrollment.matriculaId || !enrollment.alunoId || !enrollment.turmaId ||
      idSet.has(enrollment.matriculaId) || studentSet.has(enrollment.alunoId)) {
      return { ok: false, reason: "Matrículas repetidas ou sem identificação impedem contagem distinta de alunos." };
    }
    idSet.add(enrollment.matriculaId);
    studentSet.add(enrollment.alunoId);
    expected.set(enrollment.matriculaId, enrollment);
  }
  if (results.length !== expected.size) return { ok: false, reason: "Nem todas as matrículas foram resolvidas pelo RAA." };
  const classes = new Map<string, RaaClassStatus>();
  const seen = new Set<string>();
  for (const result of results) {
    const enrollment = expected.get(result.matriculaId);
    if (!enrollment || seen.has(result.matriculaId) || enrollment.alunoId !== result.alunoId ||
      enrollment.turmaId !== result.turmaId || !DECISIONS.has(result.decision)) {
      return { ok: false, reason: "Decisão RAA inconsistente, desconhecida ou fora do âmbito autorizado." };
    }
    seen.add(result.matriculaId);
    let cls = classes.get(result.turmaId);
    if (!cls) {
      cls = { turmaId: result.turmaId, total: 0, retenidos: 0,
        retidosPorAproveitamento: 0, retidosPorFaltas: 0, retidosPorIndisciplina: 0,
        pendentes: 0, emRecurso: 0, inscricaoCondicional: 0, transitaram: 0, concluiram: 0 };
      classes.set(result.turmaId, cls);
    }
    cls.total += 1;
    switch (result.decision) {
      case "retido": cls.retenidos++; cls.retidosPorAproveitamento++; break;
      case "retido_por_faltas": cls.retenidos++; cls.retidosPorFaltas++; break;
      case "retido_por_indisciplina": cls.retenidos++; cls.retidosPorIndisciplina++; break;
      case "pendente": cls.pendentes++; break;
      case "recurso": cls.emRecurso++; break;
      case "inscricao_condicional": cls.inscricaoCondicional++; break;
      case "transitou": cls.transitaram++; break;
      case "concluiu": cls.concluiram++; break;
    }
  }
  return { ok: true, classes: [...classes.values()].sort((a, b) => a.turmaId.localeCompare(b.turmaId)),
    source: "resolveRaaProgressionForMatricula" };
}

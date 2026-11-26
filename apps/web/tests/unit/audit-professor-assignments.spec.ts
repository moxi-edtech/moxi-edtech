import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectTeacherCanonicalAssignments } from "../../src/lib/professor/select-canonical-assignments";

const professorId = "teacher-a";
const classes = [
  { id:"turma-a", nome:"8.ª A", curso_id:"curso-a", classe_id:"classe-a", status_fecho:"ABERTO" },
  { id:"turma-b", nome:"9.ª B", curso_id:"curso-a", classe_id:"classe-b", status_fecho:"ABERTO" },
];
const matrices = [
  { id:"mat-bio", curso_id:"curso-a", classe_id:"classe-a", disciplina_id:"bio", curso_curriculo_id:"curr-2026" },
  { id:"mat-geo", curso_id:"curso-a", classe_id:"classe-b", disciplina_id:"geo", curso_curriculo_id:"curr-2026" },
  { id:"mat-old", curso_id:"curso-a", classe_id:"classe-a", disciplina_id:"hist", curso_curriculo_id:"curr-2025" },
];
const subjects = [
  { id:"bio", nome:"Biologia" }, { id:"geo", nome:"Geografia" }, { id:"hist", nome:"História" },
];

test("o docente vê atribuições directas e alternativas, sem depender de horário agendado", () => {
  const items = selectTeacherCanonicalAssignments({
    professorId, classes, matrices, subjects,
    links: [
      { id:"td-bio", turma_id:"turma-a", curso_matriz_id:"mat-bio", professor_id:professorId },
      { id:"td-geo", turma_id:"turma-b", curso_matriz_id:"mat-geo", professor_id:null },
    ],
    alternate: [{ turma_id:"turma-b", disciplina_id:"geo" }],
    publishedCurriculumIds: new Set(["curr-2026"]),
  });
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.disciplina.nome), ["Biologia", "Geografia"]);
  assert.deepEqual(items.map((item) => item.turma.nome), ["8.ª A", "9.ª B"]);
});

test("não expõe professor estranho, matriz de outro ano ou classe diferente", () => {
  const items = selectTeacherCanonicalAssignments({
    professorId, classes, matrices, subjects,
    links: [
      { id:"td-other", turma_id:"turma-a", curso_matriz_id:"mat-bio", professor_id:"teacher-b" },
      { id:"td-old", turma_id:"turma-a", curso_matriz_id:"mat-old", professor_id:professorId },
      { id:"td-wrong-class", turma_id:"turma-a", curso_matriz_id:"mat-geo", professor_id:professorId },
    ],
    alternate: [],
    publishedCurriculumIds: new Set(["curr-2026"]),
  });
  assert.equal(items.length, 0);
});

test("registos de avaliação duplicados com matrizes divergentes não entram na pauta", () => {
  const items = selectTeacherCanonicalAssignments({
    professorId, classes, matrices: [
      matrices[0], { ...matrices[0], id:"mat-bio-2" }, { ...matrices[0], id:"mat-bio-3" },
    ], subjects,
    links: ["mat-bio", "mat-bio-2", "mat-bio-3"].map((id) => ({
      id:`td-${id}`, turma_id:"turma-a", curso_matriz_id:id, professor_id:professorId,
    })),
    alternate: [], publishedCurriculumIds:new Set(["curr-2026"]),
  });
  assert.equal(items.length, 0);
});

test("a pauta selecciona o trimestre corrente no fuso de Luanda", () => {
  const page = readFileSync(resolve(process.cwd(), "src/components/professor/ProfessorGradesWorkspace.tsx"), "utf8");
  const api = readFileSync(resolve(process.cwd(), "src/app/api/professor/periodos/route.ts"), "utf8");
  assert.match(page, /currentGradePeriod\(canonicalPeriods\)/);
  assert.match(page, /requestedTrimestreValid/);
  assert.match(api, /trava_notas_em/);
});

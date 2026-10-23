import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { courseTurmasPageHref, courseTurmasPageKey } from "../../src/hooks/useCourseTurmasPage";
import { composeProfessorOverview } from "../../src/lib/command-center/professor-explorer";
import { composeDisciplinaOverview } from "../../src/lib/command-center/disciplina-explorer";
import type { EntityContext } from "../../src/lib/command-center/entity-context";

const context: EntityContext = {
  type: "curso", id: "course-a", escolaId: "school-a",
  label: "Curso", academicYearId: "year-2026",
};
const courseView = readFileSync("src/components/secretaria/command-center/CourseContextView.tsx", "utf8");
const classView = readFileSync("src/components/secretaria/command-center/ClasseContextView.tsx", "utf8");
const teacherView = readFileSync("src/components/secretaria/command-center/ProfessorContextView.tsx", "utf8");
const disciplineView = readFileSync("src/components/secretaria/command-center/DisciplinaContextView.tsx", "utf8");
const courseRoute = readFileSync("src/app/api/escolas/[id]/command-center/cursos/[cursoId]/turmas/route.ts", "utf8");
const disciplineRoute = readFileSync("src/app/api/escolas/[id]/command-center/disciplinas/[disciplinaId]/route.ts", "utf8");

test("EX-007: page cache and request preserve school, year, class and literal search", () => {
  const req = { context, page: 5, classeId: "class-a", search: "10 A" };
  const href = courseTurmasPageHref(req, req.search);
  assert.match(href, /ano_letivo_id=year-2026/);
  assert.match(href, /page=5/);
  assert.match(href, /pageSize=25/);
  assert.match(href, /classeId=class-a/);
  assert.match(href, /search=10\+A/);
  for (const scope of [
    { ...req, context: { ...context, escolaId: "other-school" } },
    { ...req, context: { ...context, academicYearId: "year-2025" } },
    { ...req, classeId: "class-b" },
    { ...req, page: 6 },
  ]) assert.notDeepEqual(courseTurmasPageKey(req,req.search),courseTurmasPageKey(scope,scope.search));
  assert.match(courseRoute, /requireCommandCenterSchoolWideAccess/);
  assert.match(courseRoute, /requireRoleInSchool/);
  assert.match(courseRoute, /command_center_course_turmas_page/);
  assert.match(courseView, /window\.data\?\.hasMore/);
  assert.match(courseView, /Pesquisar turmas deste curso/);
  assert.doesNotMatch(courseView, /data\.turmas\.map\(/);
});

test("EX-008: Class prioritizes contextual student action before academic directories", () => {
  const roster = classView.indexOf('aria-labelledby="classe-alunos-heading"');
  const academic = classView.indexOf('aria-labelledby="classe-turmas-heading"');
  assert.ok(roster > 0 && academic > 0 && roster < academic);
  assert.match(classView, /turmasComVagas/);
  assert.match(classView, /turma\.capacidade != null/);
  assert.match(classView, /onStudentAction/);
  assert.match(courseView, /onExploreClasse/);
  assert.match(courseView, /onExploreTurma/);
});

test("EX-009: professor matrix uses only actual allocations, not published schedule alone", () => {
  const t = (id: string) => ({
    id, nome: id, turno: "M", classeNome: "Classe",
    cursoNome: "Curso", anoLetivo: 2026, anoLetivoId: "year",
  });
  const model = composeProfessorOverview({
    turmas: [t("turma-a"), t("turma-b")],
    subjects: [{ id: "math", nome: "Matemática" }, { id: "lang", nome: "Português" }],
    allocations: [
      { turmaId: "turma-a", disciplinaId: "math" },
      { turmaId: "turma-a", disciplinaId: "math" },
      { turmaId: "turma-b", disciplinaId: null },
      { turmaId: "cross-school", disciplinaId: "math" },
    ],
    schedule: [
      { turmaId: "turma-a", disciplinaId: "lang", diaSemana: 1,
        inicio: "09:00", fim: "09:45", slotId: "slot-a" },
    ],
  });
  assert.deepEqual(model.atribuicoes.map(a => [a.turmaId,a.disciplinaId]),
    [["turma-a","math"]]);
  assert.equal(model.unresolvedDisciplineLinks,1);
  assert.equal(model.stats.aulasPublicadas,1);
  assert.equal(model.disciplinas.length,2); // schedule may reveal subject, not formal allocation
  assert.ok(!model.atribuicoes.some(a=>a.disciplinaId==="lang"));
  assert.match(teacherView, /Atribuições · Turma × Disciplina/);
  assert.match(teacherView, /Horário publicado/);
  assert.match(teacherView, /data\.unresolvedDisciplineLinks/);
});

test("EX-010: year-scoped curriculum coverage separates actual turma, teacher and schedule", () => {
  const model = composeDisciplinaOverview({
    academicYear: { id: "year-a", ano: 2026 },
    turmas: [
      { id:"turma-a", nome:"Turma A", turno:"M", classeId:"class-a",cursoId:"course-a",
        classeNome:"Classe A", cursoNome:"Curso A", anoLetivo:2026, anoLetivoId:"year-a" },
      { id:"turma-b", nome:"Turma B", turno:"T", classeId:"class-b",cursoId:"course-a",
        classeNome:"Classe B", cursoNome:"Curso A", anoLetivo:2026, anoLetivoId:"year-a" },
      { id:"turma-wrong-year", nome:"Outra", turno:"M",classeId:"class-a",cursoId:"course-a",
        classeNome:"Classe A",cursoNome:"Curso A",anoLetivo:2025,anoLetivoId:"year-b" },
    ],
    assignments: [
      { turmaId:"turma-a",professorId:"teacher-a",origem:"turma_disciplinas" },
      { turmaId:"turma-a",professorId:"teacher-a",origem:"horario_publicado" },
      { turmaId:"turma-b",professorId:"teacher-a",origem:"horario_publicado" },
      { turmaId:"turma-wrong-year",professorId:"teacher-a",origem:"turma_disciplinas" },
    ],
    teachers:[{id:"teacher-a",nome:"Prof. A",identityAvailable:true}],
    curriculum:[
      {id:"matrix-a",curriculoId:"curr-a",curriculoVersao:1,
        cursoId:"course-a",cursoNome:"Curso A",classeId:"class-a",classeNome:"Classe A",
        cargaHorariaSemanal:3,obrigatoria:true,ativo:true},
      {id:"matrix-b",curriculoId:"curr-b",curriculoVersao:1,
        cursoId:"course-a",cursoNome:"Curso A",classeId:"class-b",classeNome:"Classe B",
        cargaHorariaSemanal:3,obrigatoria:true,ativo:false},
    ],
  });
  assert.equal(model.turmas.length,2);
  assert.equal(model.turmas.find(t=>t.id==="turma-a")?.vinculoTurma,true);
  assert.equal(model.turmas.find(t=>t.id==="turma-b")?.vinculoTurma,false);
  assert.equal(model.turmas.find(t=>t.id==="turma-b")?.horarioPublicado,true);
  assert.equal(model.turmas.find(t=>t.id==="turma-b")?.docenteVinculado,false);
  assert.equal(model.turmas.find(t=>t.id==="turma-b")?.docenteEmHorario,true);
  assert.deepEqual(model.cobertura.map(c=>[c.matrizId,c.turmasComVinculo,c.turmasComDocente,c.turmasComHorario]),
    [["matrix-a",1,1,1],["matrix-b",0,0,1]]);
  assert.equal(model.curriculo.find(x=>x.id==="matrix-b")?.ativo,false);
  assert.match(disciplineRoute, /origem: "turma_disciplinas"/);
  assert.match(disciplineRoute, /origem: "horario_publicado"/);
  assert.match(disciplineView, /data\.cobertura/);
  assert.match(disciplineView, /Matriz ≠ atribuição à turma ≠ docente ≠ horário publicado/);
});

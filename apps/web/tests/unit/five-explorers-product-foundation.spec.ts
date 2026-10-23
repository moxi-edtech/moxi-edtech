import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  isEntityInAcademicYear, isClassInAcademicYear, mergeCurriculumActivity,
  academicLinkState, academicCurriculumNotice, missingTeacherEvidenceLabel,
  ACADEMIC_LINK_LABELS,
} from "../../src/lib/command-center/academic-relations";
import { ExplorerMetric } from "../../src/components/secretaria/command-center/ExplorerMetric";
import { ExplorerHistoricalScopeNotice } from "../../src/components/secretaria/command-center/ExplorerHistoricalScopeNotice";
import { TURMA_DISCIPLINAS_SELECT } from "../../src/lib/command-center/turma-explorer-policy";
import {
  composeDisciplinaOverview, indexPublishedCurricula, PublishedCurriculumConflictError,
} from "../../src/lib/command-center/disciplina-explorer";

test("EX-001: canonical year UUID wins over equal legacy numeric year", () => {
  assert.equal(isEntityInAcademicYear({ anoLetivoId: "year-b", anoLetivo: 2026 }, { id: "year-a", ano: 2026 }), false);
  assert.equal(isEntityInAcademicYear({ anoLetivoId: "year-a", anoLetivo: 2025 }, { id: "year-a", ano: 2026 }), true);
  assert.equal(isEntityInAcademicYear({ anoLetivoId: null, anoLetivo: 2026 }, { id: "year-a", ano: 2026 }), true);
  assert.equal(isEntityInAcademicYear({ anoLetivoId: null, anoLetivo: null }, { id: "year-a", ano: 2026 }), false);
});

test("EX-001: reused class is eligible through an actual correctly scoped turma", () => {
  assert.equal(isClassInAcademicYear("old-year", "current-year", 0), false);
  assert.equal(isClassInAcademicYear("old-year", "current-year", 1), true);
  assert.equal(isClassInAcademicYear("current-year", "current-year", 0), true);
  assert.equal(isClassInAcademicYear(null, "current-year", 0), true);
});

test("EX-001: active curriculum wins over duplicate inactive rows; missing is unknown", () => {
  assert.equal(mergeCurriculumActivity(null, null), null);
  assert.equal(mergeCurriculumActivity(null, false), false);
  assert.equal(mergeCurriculumActivity(false, true), true);
  assert.equal(mergeCurriculumActivity(true, false), true);
});

test("EX-001: matrix, allocated teacher and published schedule are distinct levels", () => {
  const base = {
    curriculumActive: true,
    assignedToTurma: false,
    teacherAssigned: false,
    schedulePublished: false,
    historicalYear: false,
  };
  assert.equal(academicLinkState(base), "curriculum-only");
  assert.equal(academicLinkState({ ...base, assignedToTurma: true }), "turma-assigned");
  assert.equal(academicLinkState({ ...base, teacherAssigned: true }), "teacher-assigned");
  assert.equal(academicLinkState({ ...base, schedulePublished: true }), "published");
  assert.equal(academicLinkState({ ...base, curriculumActive: false, historicalYear: true, teacherAssigned: true }), "teacher-assigned");
  assert.equal(academicLinkState({ ...base, curriculumActive: false, historicalYear: true, schedulePublished: true }), "published");
  assert.equal(academicLinkState({ ...base, curriculumActive: false, assignedToTurma: true }), "turma-assigned");
  assert.equal(academicLinkState({ ...base, curriculumActive: false }), "inactive-matrix");
  assert.equal(academicCurriculumNotice({ ...base, curriculumActive: false, historicalYear: true }),
    "Matriz atualmente inativa · vínculo histórico preservado");
  assert.equal(academicCurriculumNotice({ ...base, curriculumActive: false }),
    "Matriz inativa · verificar vínculo no ano selecionado");
  assert.equal(academicCurriculumNotice(base), null);
  assert.equal(academicLinkState({ ...base, curriculumActive: null }), "unconfirmed");
  assert.match(ACADEMIC_LINK_LABELS["inactive-matrix"], /inativa/);
});

test("EX-002: metric semantics distinguish undefined capacity, totals and partial", () => {
  const empty = renderToStaticMarkup(createElement(ExplorerMetric, { label: "Capacidade", value: null }));
  assert.match(empty, /Capacidade: não definida/);
  assert.doesNotMatch(empty, />0</);
  const exact = renderToStaticMarkup(createElement(ExplorerMetric, { label: "Alunos", value: 0 }));
  assert.match(exact, /Alunos: 0/);
  const partial = renderToStaticMarkup(createElement(ExplorerMetric, { label: "Turmas", value: 100, partial: true }));
  assert.match(partial, /contagem parcial/);
  const partialZero = renderToStaticMarkup(createElement(ExplorerMetric, { label: "Professores", value: 0, partial: true }));
  assert.match(partialZero, /Professores: 0 ou mais, contagem parcial/);
  assert.match(partialZero, />0<span aria-hidden="true">\+<\/span>/);
  assert.match(missingTeacherEvidenceLabel(true), /lista parcial/);
  assert.equal(missingTeacherEvidenceLabel(false), "Professor não vinculado");
});

test("EX-003: historic notice explains actual read-only capability, never promising unavailable search", () => {
  const html = renderToStaticMarkup(createElement(ExplorerHistoricalScopeNotice, { roster: true }));
  assert.match(html, /Histórico/);
  assert.match(html, /pesquisa operacional/);
  assert.match(html, /listagem histórica por páginas/);
});

test("EX-003: both rosters await known non-historic year before calling operational search", () => {
  const hook = readFileSync("src/hooks/useExplorerRoster.ts", "utf8");
  const classe = readFileSync("src/components/secretaria/command-center/ClasseContextView.tsx", "utf8");
  const turma = readFileSync("src/components/secretaria/command-center/TurmaContextView.tsx", "utf8");
  assert.match(hook, /enabledForYear &&/);
  assert.match(classe, /data\?\.anoLetivo\.historico === false/);
  assert.match(turma, /data\?\.turma\.anoLetivo\.historico === false/);
  assert.match(classe, /!\s*anoLetivo\.historico && \(/);
  assert.match(turma, /!\s*turma\.anoLetivo\.historico && \(/);
});

test("EX-005/006: scoped class reuse and curricular activity have provenance in APIs", () => {
  const disciplinaRoute = readFileSync("src/app/api/escolas/[id]/command-center/disciplinas/[disciplinaId]/route.ts", "utf8");
  const turmaRoute = readFileSync("src/app/api/escolas/[id]/command-center/turmas/[turmaId]/route.ts", "utf8");
  assert.match(disciplinaRoute, /from\("curso_curriculos"\)/);
  assert.match(disciplinaRoute, /in\("curso_curriculo_id", curriculumIds\)/);
  assert.doesNotMatch(disciplinaRoute, /classUsageReply|isClassInAcademicYear/);
  assert.match(disciplinaRoute, /eq\("ano_letivo_id", year\.id\)/);
  assert.match(TURMA_DISCIPLINAS_SELECT, /curso_matriz\(id,disciplina_id,ativo,/);
  assert.match(TURMA_DISCIPLINAS_SELECT, /!curso_matriz_disciplina_id_fkey/);
  assert.match(turmaRoute, /mergeCurriculumActivity/);
  assert.match(turmaRoute, /curriculumActive: d\.curriculumActive/);
});


test("EX-006: one published version includes inactive rows inline without fake history", () => {
  const overview = composeDisciplinaOverview({
    academicYear: { id: "year", ano: 2026 },
    turmas: [], assignments: [], teachers: [],
    curriculum: [
      { id: "active", curriculoId: "published", curriculoVersao: 2, cursoId: "course", cursoNome: "Curso",
        classeId: "class", classeNome: "Classe", cargaHorariaSemanal: 2, obrigatoria: true, ativo: true },
      { id: "inactive", curriculoId: "published", curriculoVersao: 2, cursoId: "course2", cursoNome: "Outro",
        classeId: "class2", classeNome: "Classe 2", cargaHorariaSemanal: 3, obrigatoria: true, ativo: false },
    ],
  });
  assert.equal(overview.curriculo.length, 2);
  assert.equal(overview.stats.cursos, 2);
  assert.equal(overview.stats.classes, 2);
  assert.equal(overview.curriculo.find((row) => row.id === "inactive")?.ativo, false);
  assert.equal("curriculoHistorico" in overview, false);
});

test("EX-006: incomplete explorer lists never claim verified absence of links", () => {
  const turma = readFileSync("src/components/secretaria/command-center/TurmaContextView.tsx", "utf8");
  const disciplina = readFileSync("src/components/secretaria/command-center/DisciplinaContextView.tsx", "utf8");
  const professor = readFileSync("src/components/secretaria/command-center/ProfessorContextView.tsx", "utf8");
  const classe = readFileSync("src/components/secretaria/command-center/ClasseContextView.tsx", "utf8");
  const curso = readFileSync("src/components/secretaria/command-center/CourseContextView.tsx", "utf8");
  const route = readFileSync("src/app/api/escolas/[id]/command-center/disciplinas/[disciplinaId]/route.ts", "utf8");
  assert.match(turma, /missingTeacherEvidenceLabel\(data\.disciplinasLimitadas\)/);
  assert.match(turma, /searchActive && \(roster\.error \|\| roster\.refreshing\)/);
  assert.match(classe, /searchActive && \(roster\.error \|\| roster\.refreshing\)/);
  assert.match(disciplina, /missingTeacherEvidenceLabel\(limitado\)/);
  assert.doesNotMatch(disciplina, /curriculoHistorico|hasOtherActivityVersion/);
  assert.match(disciplina, /item\.curriculoVersao/);
  assert.match(professor, /semAtribuicao && !limited/);
  assert.match(classe, /limitado \? "Nenhuma disciplina encontrada na lista parcial/);
  assert.match(curso, /data\.turmasLimitadas\s*\?/);
  assert.match(route, /ativo: row\.ativo/);
});


test("EX-006: canonical year and published version override archived and cross-year revisions", () => {
  const versions = [
    { id: "pub-2025", cursoId: "course", classeId: "class", anoLetivoId: "2025", version: 1, status: "published" },
    { id: "arch-2026", cursoId: "course", classeId: "class", anoLetivoId: "2026", version: 4, status: "archived" },
    { id: "pub-2026", cursoId: "course", classeId: "class", anoLetivoId: "2026", version: 2, status: "published" },
  ];
  assert.deepEqual([...indexPublishedCurricula(versions, "2025").values()].map((v) => v.id), ["pub-2025"]);
  assert.deepEqual([...indexPublishedCurricula(versions, "2026").values()].map((v) => v.id), ["pub-2026"]);
  assert.throws(() => indexPublishedCurricula([
    versions[2], { ...versions[2], id: "duplicate", version: 3 },
  ], "2026"), PublishedCurriculumConflictError);
});

test("EX-006: route scopes published curriculum before matrix and fails closed on conflict", () => {
  const route = readFileSync("src/app/api/escolas/[id]/command-center/disciplinas/[disciplinaId]/route.ts", "utf8");
  const view = readFileSync("src/components/secretaria/command-center/DisciplinaContextView.tsx", "utf8");
  assert.match(route, /from\("curso_curriculos"\)/);
  assert.match(route, /eq\("ano_letivo_id", year\.id\)\.eq\("status", "published"\)/);
  assert.match(route, /in\("curso_curriculo_id", curriculumIds\)/);
  assert.match(route, /error instanceof PublishedCurriculumConflictError/);
  assert.doesNotMatch(view, /curriculoHistorico/);
});

test("EX-006: missing or disabled teacher identity does not erase a recorded assignment", () => {
  const overview = composeDisciplinaOverview({
    academicYear: { id: "year", ano: 2026 },
    turmas: [{ id: "turma", nome: "Turma", turno: null, classeNome: null,
      cursoNome: null, anoLetivo: 2026, anoLetivoId: "year" }],
    assignments: [
      { turmaId: "turma", professorId: "orphan" },
      { turmaId: "turma", professorId: "deleted-profile" },
      { turmaId: "turma", professorId: "active-profile" },
    ],
    teachers: [
      { id: "deleted-profile", nome: "Professor com perfil desativado", identityAvailable: false },
      { id: "active-profile", nome: "Professora identificada", identityAvailable: true },
    ],
    curriculum: [],
  });
  assert.equal(overview.stats.professores, 1);
  assert.deepEqual(overview.professores.map((p) => p.id), ["active-profile"]);
  assert.equal(overview.turmas[0]?.professores.length, 3);
  assert.equal(overview.unresolvedTeacherLinks, 2);
  assert.match(overview.turmas[0]?.professores.find((p) => p.id === "orphan")?.nome ?? "",
    /identidade indisponível/);
  assert.equal(overview.turmas[0]?.professores.find((p) => p.id === "deleted-profile")?.nome,
    "Professor com perfil desativado");
  const route = readFileSync("src/app/api/escolas/[id]/command-center/disciplinas/[disciplinaId]/route.ts", "utf8");
  const view = readFileSync("src/components/secretaria/command-center/DisciplinaContextView.tsx", "utf8");
  assert.match(route, /identityAvailable: Boolean\(profile/);
  assert.match(view, /Professores identificados/);
  assert.match(view, /data\.unresolvedTeacherLinks > 0/);
});

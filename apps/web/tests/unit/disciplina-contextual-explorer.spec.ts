import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeDisciplinaOverview,
  isDisciplinaTurmaInYear,
  isPublishedDisciplinaVersion,
  normalizeDisciplinaSearch,
} from "../../src/lib/command-center/disciplina-explorer";
import {
  disciplinaContextHref, disciplinaContextQueryKey,
  disciplinaSearchHref, disciplinaSearchQueryKey,
} from "../../src/hooks/useDisciplinaContext";
import type { EntityContext } from "../../src/lib/command-center/entity-context";

const year = { id: "year-a", ano: 2026 };
const base: EntityContext = {
  type: "disciplina", id: "subject-a", escolaId: "school-a",
  label: "Matemática", academicYearId: year.id,
};
const turma = (id: string, anoLetivoId: string | null = year.id, anoLetivo = 2026) => ({
  id, nome: id, turno: "Manhã",
  cursoNome: "Curso", classeNome: "Classe",
  anoLetivoId, anoLetivo,
});

describe("Disciplina contextual explorer", () => {
  it("isolates details and search by tenant, subject, query and selected academic year", () => {
    assert.notDeepEqual(disciplinaContextQueryKey(base),
      disciplinaContextQueryKey({ ...base, escolaId: "school-b" }));
    assert.notDeepEqual(disciplinaContextQueryKey(base),
      disciplinaContextQueryKey({ ...base, academicYearId: "year-b" }));
    assert.match(disciplinaContextHref(base), /ano_letivo_id=year-a/);
    assert.match(disciplinaSearchHref("school-a", "Matemática", "year-a"), /ano_letivo_id=year-a/);
    assert.notDeepEqual(disciplinaSearchQueryKey("school-a", "year-a", "math"),
      disciplinaSearchQueryKey("school-a", "year-b", "math"));
    assert.notDeepEqual(disciplinaSearchQueryKey("school-a", "year-a", "math"),
      disciplinaSearchQueryKey("school-a", "year-a", "physics"));
  });

  it("keeps explicit year IDs authoritative over equal legacy numeric years", () => {
    assert.equal(isDisciplinaTurmaInYear(turma("a"), year), true);
    assert.equal(isDisciplinaTurmaInYear(turma("b", "year-b"), year), false);
    assert.equal(isDisciplinaTurmaInYear(turma("c", null, 2026), year), true);
    assert.equal(isDisciplinaTurmaInYear(turma("d", null, 2025), year), false);
  });

  it("deduplicates direct, legacy and published timetable assignments", () => {
    const result = composeDisciplinaOverview({
      academicYear: year,
      turmas: [turma("a"), turma("b"), turma("other-year", "year-b")],
      teachers: [{ id: "t1", nome: "Helena" }, { id: "t2", nome: "Daniel" }],
      assignments: [
        { turmaId: "a", professorId: "t1" },
        { turmaId: "a", professorId: "t1" },
        { turmaId: "a", professorId: "t2" },
        { turmaId: "b", professorId: "t1" },
        { turmaId: "b", professorId: null },
        { turmaId: "other-year", professorId: "t2" },
        { turmaId: "other-school", professorId: "t2" },
      ],
      curriculum: [
        { id: "matrix-1", curriculoId: "published-class-1", curriculoVersao: 2,
          cursoId: "course-1", cursoNome: "Geral", classeId: "class-1", classeNome: "8.ª",
          cargaHorariaSemanal: 4, obrigatoria: true, ativo: true },
        { id: "matrix-1", curriculoId: "published-class-1", curriculoVersao: 2,
          cursoId: "course-1", cursoNome: "Geral", classeId: "class-1", classeNome: "8.ª",
          cargaHorariaSemanal: 4, obrigatoria: true, ativo: true },
        { id: "matrix-2", curriculoId: "published-class-2", curriculoVersao: 1,
          cursoId: "course-1", cursoNome: "Geral", classeId: "class-2", classeNome: "9.ª",
          cargaHorariaSemanal: 5, obrigatoria: true, ativo: true },
      ],
    });
    assert.deepEqual(result.stats, { professores: 2, turmas: 2, cursos: 1, classes: 2 });
    assert.deepEqual(result.professores.map((t) => [t.id, t.turmas]), [["t2", 1], ["t1", 2]]);
    assert.equal(result.turmas.find((t) => t.id === "a")?.professores.length, 2);
    assert.equal(result.curriculo.length, 2);
    assert.ok(!JSON.stringify(result).includes("other-year"));
    assert.ok(!JSON.stringify(result).includes("other-school"));
  });

  it("keeps curriculum distinct from actual teacher assignments", () => {
    const result = composeDisciplinaOverview({
      academicYear: year,
      turmas: [turma("a")],
      teachers: [],
      assignments: [],
      curriculum: [{ id: "matrix-c", curriculoId: "published-cl", curriculoVersao: 1,
        cursoId: "c", cursoNome: "Geral", classeId: "cl", classeNome: "10.ª",
        cargaHorariaSemanal: 2, obrigatoria: false, ativo: true }],
    });
    assert.equal(result.stats.cursos, 1);
    assert.equal(result.stats.turmas, 0);
    assert.equal(result.stats.professores, 0);
    assert.equal(result.curriculo.length, 1);
  });

  it("preserves a missing teacher link without counting or navigating to an unverified identity", () => {
    const result = composeDisciplinaOverview({
      academicYear: year,
      turmas: [turma("a")],
      teachers: [],
      assignments: [{ turmaId: "a", professorId: "missing-teacher" }],
      curriculum: [],
    });
    assert.equal(result.stats.turmas, 1);
    assert.equal(result.stats.professores, 0);
    assert.equal(result.unresolvedTeacherLinks, 1);
    assert.deepEqual(result.professores, []);
    assert.equal(result.turmas[0]?.professores[0]?.id, "missing-teacher");
    assert.match(result.turmas[0]?.professores[0]?.nome ?? "", /identidade indisponível/);
  });

  it("only accepts published timetable state", () => {
    assert.equal(isPublishedDisciplinaVersion("publicada"), true);
    for (const status of ["draft", "arquivada", "publicado", null, undefined]) {
      assert.equal(isPublishedDisciplinaVersion(status), false);
    }
  });

  it("normalizes search so PostgREST filters cannot be injected as syntax", () => {
    assert.equal(normalizeDisciplinaSearch("  Matemática,  (nome.eq.foo)  "), "Matemática nome eq foo");
    assert.equal(normalizeDisciplinaSearch("Arte%_,.\\()"), "Arte");
    assert.ok(normalizeDisciplinaSearch("a".repeat(200)).length <= 72);
  });
});

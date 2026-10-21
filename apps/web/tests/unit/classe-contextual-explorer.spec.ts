import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classeEnrollmentStatuses, classePageRange, composeClasseOverview,
  isClasseAvailableInYear,
  isClasseTurmaInYear,
} from "../../src/lib/command-center/classe-explorer";
import { classeContextHref, classeContextQueryKey } from "../../src/hooks/useClasseContext";
import type { EntityContext } from "../../src/lib/command-center/entity-context";

const year = { id: "school-a-year-2026", ano: 2026 };
const turma = (id: string, anoLetivoId: string | null = year.id, anoLetivo = 2026) => ({
  id, nome: id, turno: "Manhã", sala: null,
  capacidade: 30, cursoId: "curso-a", anoLetivo, anoLetivoId,
});
const student = (id: string, turmaId: string, enrollmentId: string = id) => ({
  id: enrollmentId, alunoId: id, turmaId, nome: id, numeroChamada: 1,
});

const context: EntityContext = {
  type: "classe", id: "class-a", label: "10ª", escolaId: "school-a", academicYearId: year.id,
};

describe("Explorador contextual de Classes", () => {
  it("isolates client cache by school, class, year and page", () => {
    const key = classeContextQueryKey(context, 1);
    assert.notDeepEqual(key, classeContextQueryKey({ ...context, escolaId: "school-b" }, 1));
    assert.notDeepEqual(key, classeContextQueryKey({ ...context, id: "other-class" }, 1));
    assert.notDeepEqual(key, classeContextQueryKey({ ...context, academicYearId: "other-year" }, 1));
    assert.notDeepEqual(key, classeContextQueryKey(context, 2));
    assert.match(classeContextHref(context, 3), /ano_letivo_id=school-a-year-2026/);
    assert.match(classeContextHref(context, 3), /page=3/);
  });

  it("treats explicit academic year ID as authoritative", () => {
    assert.equal(isClasseTurmaInYear(turma("a"), year), true);
    assert.equal(isClasseTurmaInYear(turma("b", "other-school-year", 2026), year), false);
    assert.equal(isClasseTurmaInYear(turma("c", null, 2026), year), true);
    assert.equal(isClasseTurmaInYear(turma("d", null, 2025), year), false);
  });

  it("allows reused classes with real turmas in another selected year", () => {
    assert.equal(isClasseAvailableInYear(null, year.id, []), true);
    assert.equal(isClasseAvailableInYear(year.id, year.id, []), true);
    assert.equal(isClasseAvailableInYear("old-year", year.id, []), false);
    assert.equal(isClasseAvailableInYear("old-year", year.id, [turma("current")]), true);
  });

  it("reuses turma roster policy excluding pending, cancelled and transferred", () => {
    assert.deepEqual(classeEnrollmentStatuses(false), {
      statuses: ["ativo"], requireActive: true,
    });
    assert.deepEqual(classeEnrollmentStatuses(true), {
      statuses: ["ativo", "concluido"], requireActive: false,
    });
  });

  it("counts unique students across all turmas and separates known capacity", () => {
    const result = composeClasseOverview({
      year,
      turmas: [turma("a"), turma("b")],
      enrollments: [
        student("ana", "a", "mat-1"),
        student("ana", "b", "mat-2"),
        student("ana", "a", "mat-1"),
        student("beto", "b", "mat-3"),
        student("outsider", "other-school", "mat-x"),
      ],
      curriculum: [{ id: "matrix-math", disciplinaId: "math", cargaHorariaSemanal: 4, obrigatoria: true }],
      assignments: [
        { turmaId: "a", disciplinaId: "math", professorId: "prof-a" },
        { turmaId: "a", disciplinaId: "math", professorId: "prof-a" },
        { turmaId: "b", disciplinaId: "math", professorId: "prof-a" },
        { turmaId: "b", disciplinaId: "bio", professorId: "prof-b" },
        { turmaId: "other-school", disciplinaId: "math", professorId: "prof-a" },
      ],
      subjects: [{ id: "math", nome: "Matemática" }, { id: "bio", nome: "Biologia" }],
      teachers: [{ id: "prof-a", nome: "Amália" }, { id: "prof-b", nome: "Daniel" }],
      page: 1, pageSize: 20,
    });
    assert.deepEqual(result.stats, {
      alunos: 2, turmas: 2, capacidade: 60, disciplinas: 2, professores: 2,
    });
    assert.equal(result.turmas[0].alunos, 1);
    assert.equal(result.turmas[1].alunos, 2);
    assert.equal(result.alunos.items.length, 2);
    assert.equal(result.professores.find((p) => p.id === "prof-a")?.turmas, 2);
    assert.equal(result.disciplinas.find((d) => d.id === "math")?.turmas, 2);
    assert.equal(result.disciplinas.find((d) => d.id === "bio")?.naMatriz, false);
    assert.ok(!JSON.stringify(result).includes("other-school"));
  });

  it("does not mix turmas of another academic year when class is reused", () => {
    const result = composeClasseOverview({
      year,
      turmas: [turma("current"), turma("historical", "old-year")],
      enrollments: [student("ana", "current"), student("beto", "historical")],
      curriculum: [], assignments: [{ turmaId: "historical", disciplinaId: "math", professorId: "t1" }],
      teachers: [{ id: "t1", nome: "Teresa" }], subjects: [{ id: "math", nome: "Matemática" }],
      page: 1,
    });
    assert.equal(result.stats.turmas, 1);
    assert.equal(result.stats.alunos, 1);
    assert.equal(result.stats.professores, 0);
    assert.equal(result.stats.disciplinas, 0);
  });

  it("does not make a missing RLS-restricted teacher or subject navigable", () => {
    const result = composeClasseOverview({
      year,
      turmas: [turma("a")],
      enrollments: [],
      curriculum: [{ id: "matrix-x", disciplinaId: "unavailable", cargaHorariaSemanal: 3, obrigatoria: true }],
      assignments: [{ turmaId: "a", disciplinaId: "unavailable", professorId: "unavailable-teacher" }],
      subjects: [], teachers: [], page: 1,
    });
    assert.equal(result.stats.disciplinas, 0);
    assert.equal(result.stats.professores, 0);
    assert.equal(result.turmas[0].professores, 0);
  });

  it("keeps real empty states and does not infer capacity when any turma is undefined", () => {
    const empty = composeClasseOverview({
      year, turmas: [], enrollments: [], curriculum: [], assignments: [],
      subjects: [], teachers: [], page: 1,
    });
    assert.deepEqual(empty.stats, {
      turmas: 0, alunos: 0, capacidade: 0, disciplinas: 0, professores: 0,
    });
    const partial = composeClasseOverview({
      year,
      turmas: [{ ...turma("a"), capacidade: null }],
      enrollments: [], curriculum: [], assignments: [],
      subjects: [], teachers: [], page: 1,
    });
    assert.equal(partial.stats.capacidade, null);
  });

  it("pages distinct students without duplicating IDs across pages", () => {
    const result = composeClasseOverview({
      year, turmas: [turma("a")],
      enrollments: Array.from({ length: 43 }, (_, i) => student(`student-${i}`, "a")),
      curriculum: [], assignments: [], subjects: [], teachers: [],
      page: 3, pageSize: 20,
    });
    assert.equal(result.alunos.total, 43);
    assert.equal(result.alunos.items.length, 3);
    assert.equal(result.alunos.hasMore, false);
    assert.deepEqual(classePageRange(2, 20), { from: 20, to: 39 });
    assert.throws(() => classePageRange(0), RangeError);
    assert.throws(() => classePageRange(1, 101), RangeError);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  belongsToProfessorAcademicYear,
  composeProfessorOverview,
  isPublishedTimetableVersion,
  PROFESSOR_WEEKDAYS,
} from "../../src/lib/command-center/professor-explorer";
import { professorContextHref, professorContextQueryKey } from "../../src/hooks/useProfessorContext";
import type { EntityContext } from "../../src/lib/command-center/entity-context";

const context: EntityContext = {
  type: "professor",
  id: "teacher-a", escolaId: "school-a",
  label: "Docente", academicYearId: "year-a",
};

const turma = (id: string) => ({
  id, nome: id, turno: "Manhã", classeNome: "8.ª",
  cursoNome: "Ensino geral", anoLetivo: 2026, anoLetivoId: "year-a",
});

describe("Professor contextual explorer", () => {
  it("isolates cache keys and preserves the academic year in the URL", () => {
    assert.notDeepEqual(
      professorContextQueryKey(context),
      professorContextQueryKey({ ...context, escolaId: "school-b" }),
    );
    assert.notDeepEqual(
      professorContextQueryKey(context),
      professorContextQueryKey({ ...context, academicYearId: "year-b" }),
    );
    assert.match(professorContextHref(context), /ano_letivo_id=year-a/);
    assert.ok(!professorContextHref({ ...context, academicYearId: null }).includes("ano_letivo_id"));
  });

  it("never mixes an explicit academic-year ID with a matching numeric year from another context", () => {
    assert.equal(belongsToProfessorAcademicYear(turma("one"), { id: "year-a", ano: 2026 }), true);
    assert.equal(belongsToProfessorAcademicYear(turma("one"), { id: "year-b", ano: 2026 }), false);
    assert.equal(belongsToProfessorAcademicYear({ anoLetivoId: null, anoLetivo: 2026 }, { id: "year-a", ano: 2026 }), true);
    assert.equal(belongsToProfessorAcademicYear({ anoLetivoId: null, anoLetivo: 2025 }, { id: "year-a", ano: 2026 }), false);
  });

  it("deduplicates assignments from direct, legacy and timetable links", () => {
    const result = composeProfessorOverview({
      turmas: [turma("a"), turma("b")],
      subjects: [{ id: "math", nome: "Matemática" }, { id: "bio", nome: "Biologia" }],
      allocations: [
        { turmaId: "a", disciplinaId: "math" },
        { turmaId: "a", disciplinaId: "math" },
        { turmaId: "a", disciplinaId: "bio" },
        { turmaId: "b", disciplinaId: "math" },
        { turmaId: "other-school", disciplinaId: "math" },
      ],
      schedule: [
        { turmaId: "a", disciplinaId: "math", diaSemana: 1, inicio: "08:00", fim: "08:45", slotId: "slot-a" },
        { turmaId: "a", disciplinaId: "math", diaSemana: 1, inicio: "08:00", fim: "08:45", slotId: "slot-a" },
        { turmaId: "b", disciplinaId: "math", diaSemana: 2, inicio: "09:00", fim: "09:45", slotId: "slot-b" },
        { turmaId: "other-school", disciplinaId: "bio", diaSemana: 3, inicio: "10:00", fim: "10:45", slotId: "slot-z" },
      ],
    });
    assert.deepEqual(result.stats, { turmas: 2, disciplinas: 2, aulasPublicadas: 2 });
    assert.equal(result.disciplinas.find((d) => d.id === "math")?.turmas, 2);
    assert.equal(result.disciplinas.find((d) => d.id === "bio")?.turmas, 1);
    assert.equal(result.horarios[0]?.turmaId, "a");
    assert.ok(!JSON.stringify(result).includes("other-school"));
  });

  it("includes teacher's published schedule-only turma and retains genuine empty states", () => {
    const scheduled = composeProfessorOverview({
      turmas: [turma("c")],
      allocations: [],
      subjects: [],
      schedule: [{ turmaId: "c", disciplinaId: null, diaSemana: 5, inicio: "14:00", fim: "15:00", slotId: "s" }],
    });
    assert.equal(scheduled.stats.turmas, 1);
    assert.equal(scheduled.stats.disciplinas, 0);
    assert.equal(scheduled.stats.aulasPublicadas, 1);
    const empty = composeProfessorOverview({ turmas: [], subjects: [], allocations: [], schedule: [] });
    assert.deepEqual(empty.stats, { turmas: 0, disciplinas: 0, aulasPublicadas: 0 });
  });

  it("rejects draft and archived timetable versions", () => {
    assert.equal(isPublishedTimetableVersion("publicada"), true);
    for (const status of ["draft", "arquivada", "publicado", "", null, undefined]) {
      assert.equal(isPublishedTimetableVersion(status), false);
    }
    assert.equal(PROFESSOR_WEEKDAYS[1], "Segunda");
  });

  it("never derives subjects from an unrecognized catalogue ID", () => {
    const result = composeProfessorOverview({
      turmas: [turma("a")],
      allocations: [{ turmaId: "a", disciplinaId: "unknown" }],
      subjects: [{ id: "known", nome: "Física" }],
      schedule: [],
    });
    assert.equal(result.stats.turmas, 1);
    assert.equal(result.stats.disciplinas, 0);
  });
});

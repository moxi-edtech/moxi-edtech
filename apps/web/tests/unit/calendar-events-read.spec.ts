import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CalendarEventScopeError,
  isCalendarEventVisibleToOfferings,
  readScopedAcademicCalendarEvents,
  resolveCalendarOfferingForCourse,
  validateCalendarEventScope,
} from "../../src/lib/academico/calendar-events-read";

const escolaId = "40000000-0000-0000-0000-000000000001";
const anoLetivoId = "40000000-0000-0000-0000-000000000002";
const cursoId = "40000000-0000-0000-0000-000000000003";
const regularId = "40000000-0000-0000-0000-000000000005";
const tecnicoId = "40000000-0000-0000-0000-000000000006";

function createSupabaseMock(rows: unknown[] = []) {
  const calls: Array<[string, unknown]> = [];
  const chain: any = {};
  for (const name of ["select", "eq", "is", "or", "gte", "lte", "order"]) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return chain;
    };
  }
  chain.limit = (limit: number) => {
    calls.push(["limit", limit]);
    return Promise.resolve({ data: rows, error: null });
  };
  const db = {
    from(table: string) {
      calls.push(["from", table]);
      return chain;
    },
  };
  return { db, calls };
}

test("Global events are visible to all; technical course events never leak to regular course", () => {
  assert.equal(isCalendarEventVisibleToOfferings({ offering_id: null }, [regularId]), true);
  assert.equal(isCalendarEventVisibleToOfferings({ offering_id: regularId }, [regularId]), true);
  assert.equal(isCalendarEventVisibleToOfferings({ offering_id: tecnicoId }, [regularId]), false);
  assert.equal(isCalendarEventVisibleToOfferings({ offering_id: tecnicoId }, []), false);
});

test("Student event query requires authorized school/year/course and uses DB-level scoped filter", async () => {
  const { db, calls } = createSupabaseMock([{ id: "global" }, { id: "regular" }]);
  const result = await readScopedAcademicCalendarEvents(db, {
    escolaId, anoLetivoId, offeringIds: [regularId],
    rangeStart: "2026-10-29", limit: 3,
  });
  assert.equal(result.length, 2);
  assert.deepEqual(calls.filter(([name]) => name === "eq"), [
    ["eq", ["escola_id", escolaId]],
    ["eq", ["ano_letivo_id", anoLetivoId]],
  ]);
  assert.deepEqual(calls.filter(([name]) => name === "or"), [
    ["or", [`offering_id.is.null,offering_id.in.(${regularId})`]],
  ]);
  assert.deepEqual(calls.filter(([name]) => name === "gte"),
    [["gte", ["data_fim", "2026-10-29"]]]);
  assert.deepEqual(calls.at(-1), ["limit", 3]);
});

test("Students without an assigned course can see only global events, never every course", async () => {
  const { db, calls } = createSupabaseMock([]);
  await readScopedAcademicCalendarEvents(db, {
    escolaId, anoLetivoId, offeringIds: [], limit: 3,
  });
  assert.deepEqual(calls.filter(([name]) => name === "is"),
    [["is", ["offering_id", null]]]);
  assert.equal(calls.some(([name]) => name === "or"), false);
});

test("Invalid ids, duplicates and injected filters fail before reaching PostgREST", async () => {
  const { db, calls } = createSupabaseMock([]);
  for (const invalid of [
    { escolaId: "other", anoLetivoId, offeringIds: [regularId] },
    { escolaId, anoLetivoId, offeringIds: [regularId, regularId] },
    { escolaId, anoLetivoId, offeringIds: ["x),escola_id.neq."] },
  ]) {
    assert.throws(() => validateCalendarEventScope(invalid),
      (cause: unknown) => cause instanceof CalendarEventScopeError &&
        cause.code === "CALENDAR_INVALID_SCOPE");
    await assert.rejects(() => readScopedAcademicCalendarEvents(db, invalid),
      (cause: unknown) => cause instanceof CalendarEventScopeError &&
        cause.code === "CALENDAR_INVALID_SCOPE");
  }
  assert.deepEqual(calls, []);
});

test("A course mapping must be unique and belong to the same school", async () => {
  const { db, calls } = createSupabaseMock([{ id: regularId }]);
  const offering = await resolveCalendarOfferingForCourse(db, { escolaId, cursoId });
  assert.equal(offering, regularId);
  assert.deepEqual(calls.filter(([name]) => name === "eq"), [
    ["eq", ["escola_id", escolaId]],
    ["eq", ["course_id", cursoId]],
    ["eq", ["status", "active"]],
  ]);
  assert.deepEqual(calls.at(-1), ["limit", 2]);
});

test("Missing and ambiguous course mappings fail closed", async () => {
  for (const rows of [[], [{ id: regularId }, { id: tecnicoId }]]) {
    const { db } = createSupabaseMock(rows);
    await assert.rejects(
      () => resolveCalendarOfferingForCourse(db, { escolaId, cursoId }),
      (cause: unknown) => cause instanceof CalendarEventScopeError &&
        cause.code === (rows.length === 0
          ? "CALENDAR_COURSE_NOT_MAPPED"
          : "CALENDAR_COURSE_AMBIGUOUS"),
    );
  }
});

test("Student route enforces authorized child, year and turma before querying events", () => {
  const route = readFileSync(resolve(process.cwd(),
    "src/app/api/aluno/home/academic-events/route.ts"), "utf8");
  assert.match(route, /getAlunoContext/);
  assert.match(route, /requestedId && !ctx\.alunoIds\.includes\(requestedId\)/);
  assert.match(route, /resolveSelectedStudentId/);
  assert.match(route, /resolveBoletimMatricula/);
  assert.match(route, /anoLetivoId: params\.get\("ano_letivo_id"\)/);
  assert.match(route, /\.eq\("ano_letivo_id", context\.anoLetivoId\)/);
  assert.match(route, /resolveCalendarOfferingForCourse/);
  assert.match(route, /readScopedAcademicCalendarEvents/);
  assert.match(route, /schoolCalendarDate\(new Date\(\), context\.timezone\)/);
  assert.doesNotMatch(route, /\.limit\(3\)/);
});

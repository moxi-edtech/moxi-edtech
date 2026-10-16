import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTargetAcademicYear,
  resolvePublishedAcademicCalendar,
  type OfficialAcademicTemplate,
} from "../../src/lib/academico/target-academic-year";

const official = (overrides: Partial<OfficialAcademicTemplate> = {}): OfficialAcademicTemplate => ({
  ano_base: 2026,
  data_inicio: "2026-09-02",
  data_fim: "2027-07-25",
  items: [{ tipo: "PERIODO_LETIVO", data_inicio: "2026-09-02", data_fim: "2027-02-02" }],
  ...overrides,
});

test("cross-year published calendar produces next target, not active year", () => {
  assert.deepEqual(resolvePublishedAcademicCalendar({
    templates: [official()],
    activeYear: { ano: 2026, data_fim: "2026-07-30" },
  }), { year: 2027, dataInicio: "2026-09-02", dataFim: "2027-07-25" });
});

test("Jan-Dec academic year remains in the intended year", () => {
  const result = resolvePublishedAcademicCalendar({
    templates: [official({ ano_base: 2027, data_inicio: "2027-01-08", data_fim: "2027-12-15", items: [] })],
    activeYear: { ano: 2026, data_fim: "2026-12-31" },
  });
  assert.equal(result.year, 2027);
});

test("atypical dates with a valid cross-year range are accepted", () => {
  const result = resolvePublishedAcademicCalendar({
    templates: [official({ data_inicio: "2026-11-30", data_fim: "2027-03-15", items: [] })],
    activeYear: { ano: 2026, data_fim: "2026-10-30" },
  });
  assert.equal(result.dataInicio, "2026-11-30");
});

test("multiple published subsystems have a combined, bounded school session", () => {
  assert.deepEqual(resolvePublishedAcademicCalendar({
    templates: [
      official({ items: [] }),
      official({ data_inicio: "2026-08-30", data_fim: "2027-08-01", items: [] }),
    ],
    activeYear: { ano: 2026, data_fim: "2026-07-31" },
  }), { year: 2027, dataInicio: "2026-08-30", dataFim: "2027-08-01" });
});

test("missing dates, invalid leap day, reversed and overly long ranges fail closed", () => {
  for (const template of [
    official({ data_inicio: null }),
    official({ data_fim: null }),
    official({ data_inicio: "2026-02-29", items: [] }),
    official({ data_fim: "2026-03-01", items: [] }),
    official({ data_fim: "2028-10-01", items: [] }),
  ]) {
    assert.throws(() => resolvePublishedAcademicCalendar({ templates: [template], activeYear: null }));
  }
});

test("published calendar cannot overlap active academic session", () => {
  assert.throws(() => resolvePublishedAcademicCalendar({
    templates: [official()],
    activeYear: { ano: 2026, data_fim: "2026-10-15" },
  }), /overlaps/);
});

test("academic items cannot exceed published template boundaries", () => {
  assert.throws(() => resolvePublishedAcademicCalendar({
    templates: [official({
      items: [{ tipo: "PERIODO_LETIVO", data_inicio: "2026-08-31", data_fim: "2027-04-10" }],
    })],
    activeYear: null,
  }), /outside/);
});

test("inconsistent base year and incompatible mixed templates fail", () => {
  assert.throws(() => resolvePublishedAcademicCalendar({
    templates: [official({ ano_base: 2029 })],
    activeYear: null,
  }));
  assert.throws(() => resolvePublishedAcademicCalendar({
    templates: [official({ items: [] }), official({ ano_base: 2027, data_inicio: "2027-09-01", data_fim: "2028-07-01", items: [] })],
    activeYear: null,
  }), /different academic years/);
});

test("invalid calendar values and a stale base year are rejected", () => {
  assert.throws(() => resolveTargetAcademicYear(NaN, 2027));
  assert.throws(() => resolveTargetAcademicYear(2027, 2101));
  assert.throws(() => resolveTargetAcademicYear(2026, 2027), /older/);
  assert.equal(resolveTargetAcademicYear(2027, null), 2027);
});

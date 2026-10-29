import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalMedCalendarPlan,
  CanonicalCalendarError,
  type MedCourseProfile,
  type MedCourseOffering,
} from "../../src/lib/academico/canonical-med-calendar";

const commonTerms = [
  { numero: 1, data_inicio: "2026-09-01", data_fim: "2026-12-18", peso: 30 },
  { numero: 2, data_inicio: "2027-01-04", data_fim: "2027-04-09", peso: 30 },
  { numero: 3, data_inicio: "2027-04-26", data_fim: "2027-06-18", peso: 40 },
];
const calendar = {
  ano_base: 2026, data_inicio: "2026-09-01", data_fim: "2027-08-31",
  estado: "PUBLICADO", versao_documento: "FINAL-ACTUALIZADO",
};
const profile = (id: string, subsystem: string, eventName: string): MedCourseProfile => ({
  id, ano_base: 2026, calendario_canonico_ano: 2026,
  data_inicio: calendar.data_inicio, data_fim: calendar.data_fim,
  versao_documento: calendar.versao_documento,
  subsistema: subsystem, is_oficial: true, estado: "PUBLICADO",
  items: [
    ...commonTerms.map((p) => ({
      id: `${id}-p${p.numero}`, numero: p.numero, tipo: "PERIODO_LETIVO",
      nome: `${p.numero}.º trimestre`, data_inicio: p.data_inicio,
      data_fim: p.data_fim, peso: p.peso, applies_to_all_offerings: true,
    })),
    { id: `${id}-holiday`, numero: null, tipo: "FERIADO",
      nome: "Dia nacional", data_inicio: "2026-11-11", data_fim: "2026-11-11",
      peso: null, applies_to_all_offerings: true },
    { id: `${id}-exam`, numero: null, tipo: "EXAME_ESCRITO",
      nome: eventName, data_inicio: "2027-06-20", data_fim: "2027-06-24",
      peso: null, applies_to_all_offerings: true },
  ],
});
const offerings: MedCourseOffering[] = [
  { id: "regular-9", course_id: "course-regular", education_subsystem: "REGULAR_ADULTOS",
    education_level: "SECONDARY", cycle: null, grades: ["9"] },
  { id: "technical-12", course_id: "course-technical", education_subsystem: "TECNICO_PROFISSIONAL",
    education_level: "SECONDARY", cycle: null, grades: ["12"] },
];
const profiles = [
  profile("regular", "REGULAR_ADULTOS", "Exames regulares"),
  profile("technical", "TECNICO_PROFISSIONAL", "Exames técnicos"),
];
const selections = [
  { offering_id: "regular-9", template_id: "regular" },
  { offering_id: "technical-12", template_id: "technical" },
];
const input = { calendar, profiles, offerings, selections };

test("One official calendar governs the three terms across two different courses", () => {
  const plan = buildCanonicalMedCalendarPlan(input);
  assert.strictEqual(plan.calendar, calendar);
  assert.equal(plan.periods.length, 3);
  assert.deepEqual(plan.periods.map((p) => [p.numero, p.data_inicio, p.data_fim]),
    commonTerms.map((p) => [p.numero, p.data_inicio, p.data_fim]));
  assert.ok(plan.periods.every((p) => p.source_template_id === "regular"));
  assert.equal(plan.courseCount, 2);
});

test("Schoolwide holidays are shared; subsystem-specific exams remain bound to their courses", () => {
  const plan = buildCanonicalMedCalendarPlan(input);
  const holidays = plan.events.filter((e) => e.tipo === "FERIADO");
  assert.equal(holidays.length, 1);
  assert.equal(holidays[0].offering_id, null);
  const exams = plan.events.filter((e) => e.tipo === "EXAME_ESCRITO");
  assert.equal(exams.length, 2);
  assert.deepEqual(exams.map((e) => [e.offering_id, e.nome]),
    [["regular-9", "Exames regulares"], ["technical-12", "Exames técnicos"]]);
});

test("Multiple courses in one subsystem inherit the same profile without duplicate shared events", () => {
  const secondary = { ...offerings[0], id: "regular-12", course_id: "another-course", grades: ["12"] };
  const plan = buildCanonicalMedCalendarPlan({
    calendar, profiles,
    offerings: [offerings[0], secondary],
    selections: [
      { offering_id: "regular-9", template_id: "regular" },
      { offering_id: "regular-12", template_id: "regular" },
    ],
  });
  assert.equal(plan.periods.length, 3);
  assert.equal(plan.events.filter((e) => e.nome === "Dia nacional").length, 1);
  assert.equal(plan.events.filter((e) => e.nome === "Exames regulares").length, 1);
});

test("An official event restricted to class 9 belongs only to the matching course", () => {
  const p = profile("regular", "REGULAR_ADULTOS", "Exames regulares");
  p.items.push({
    id: "regular-grade9", numero: null, tipo: "EXAME_ORAL",
    nome: "Prova da 9.ª classe", data_inicio: "2027-06-25", data_fim: "2027-06-26",
    peso: null, applies_to_all_offerings: false, grade_codes: ["9"],
  });
  const plan = buildCanonicalMedCalendarPlan({
    calendar, profiles: [p],
    offerings: [offerings[0], { ...offerings[0], id: "regular-12", grades: ["12"] }],
    selections: [
      { offering_id: "regular-9", template_id: "regular" },
      { offering_id: "regular-12", template_id: "regular" },
    ],
  });
  const restricted = plan.events.filter((e) => e.nome === "Prova da 9.ª classe");
  assert.equal(restricted.length, 1);
  assert.equal(restricted[0].offering_id, "regular-9");
});

test("A course may not use a different subsystem or year profile", () => {
  for (const mismatched of [
    { ...input, selections: [{ offering_id: "regular-9", template_id: "technical" }, selections[1]] },
    { ...input, profiles: [{ ...profiles[0], calendario_canonico_ano: 2025 }, profiles[1]] },
    { ...input, profiles: [{ ...profiles[0], versao_documento: "OLD" }, profiles[1]] },
  ]) {
    assert.throws(() => buildCanonicalMedCalendarPlan(mismatched),
      (e: unknown) => e instanceof CanonicalCalendarError && e.code === "COURSE_CALENDAR_PROFILE_MISMATCH");
  }
});

test("One missing or duplicate course mapping blocks the entire academic-year operation", () => {
  for (const mappings of [selections.slice(0, 1),
    [selections[0], selections[0]]]) {
    assert.throws(() => buildCanonicalMedCalendarPlan({ ...input, selections: mappings }),
      (e: unknown) => e instanceof CanonicalCalendarError && e.code === "COURSE_CALENDAR_MAPPING_INCOMPLETE");
  }
});

test("The plan rejects different term dates even when each profile is published", () => {
  const different: MedCourseProfile = {
    ...profiles[1],
    items: profiles[1].items.map((item) =>
      item.numero === 2 ? { ...item, data_fim: "2027-04-08" } : item),
  };
  assert.throws(() => buildCanonicalMedCalendarPlan({
    ...input, profiles: [profiles[0], different],
  }), (e: unknown) => e instanceof CanonicalCalendarError &&
    e.code === "ACADEMIC_MULTI_TEMPLATE_PERIOD_DIVERGENCE");
});

test("The canonical planner is pure and never modifies the source template or offering mappings", () => {
  const before = JSON.stringify(input);
  buildCanonicalMedCalendarPlan(input);
  assert.equal(JSON.stringify(input), before);
});

test("A contradictory global flag cannot bypass explicit grade restrictions", () => {
  const p = profile("regular", "REGULAR_ADULTOS", "Exames regulares");
  p.items.push({
    id: "ninth-only", numero: null, tipo: "EXAME_ORAL",
    nome: "Prova específica da 9.ª classe",
    data_inicio: "2027-06-25", data_fim: "2027-06-26",
    peso: null, applies_to_all_offerings: true, grade_codes: ["9"],
  });
  const plan = buildCanonicalMedCalendarPlan({
    calendar, profiles: [p],
    offerings: [offerings[0], { ...offerings[0], id: "regular-12", grades: ["12"] }],
    selections: [
      { offering_id: "regular-9", template_id: "regular" },
      { offering_id: "regular-12", template_id: "regular" },
    ],
  });
  const matched = plan.events.filter((e) => e.source_item_id === "ninth-only");
  assert.equal(matched.length, 1);
  assert.equal(matched[0].offering_id, "regular-9");
});

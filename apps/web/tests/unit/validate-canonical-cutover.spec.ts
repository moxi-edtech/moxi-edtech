import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  reviewCanonicalCutoverTarget,
  type RecordedEvent,
  type RecordedPeriod,
} from "../../src/lib/academico/validate-canonical-cutover";
import type { MedCourseProfile, MedCourseOffering } from "../../src/lib/academico/canonical-med-calendar";

const calendar = {
  ano_base: 2026, data_inicio: "2026-09-01", data_fim: "2027-08-31",
  versao_documento: "FINAL-ACTUALIZADO", estado: "PUBLICADO",
};
const target = { id: "target", ano: 2026, data_inicio: calendar.data_inicio, data_fim: calendar.data_fim };
const dates = [
  ["2026-09-01", "2026-12-18"],
  ["2027-01-04", "2027-04-09"],
  ["2027-04-26", "2027-06-18"],
];
function profile(id: string, subsystem: string): MedCourseProfile {
  return {
    id, ano_base: 2026, calendario_canonico_ano: 2026, data_inicio: calendar.data_inicio,
    data_fim: calendar.data_fim, is_oficial: true, estado: "PUBLICADO",
    subsistema: subsystem, versao_documento: calendar.versao_documento,
    items: [
      ...dates.map(([a,b],i) => ({
        id: `${id}-period-${i+1}`, tipo: "PERIODO_LETIVO", numero: i+1,
        nome: `${i+1}.º trimestre`, data_inicio: a, data_fim: b,
        peso: i===2 ? 40 : 30,
      })),
      { id: `${id}-exam`, tipo: "EXAME_ESCRITO", numero: null, nome: `Exame ${subsystem}`,
        data_inicio: "2027-06-20", data_fim: "2027-06-24",
        peso: null, applies_to_all_offerings: false, education_subsystems: [subsystem] },
    ],
  };
}
const profiles = [profile("regular", "REGULAR_ADULTOS"), profile("technical", "TECNICO_PROFISSIONAL")];
const offerings: MedCourseOffering[] = [
  { id: "regular-course", course_id: "c1", education_subsystem: "REGULAR_ADULTOS",
    education_level: "SECONDARY", cycle: null, grades: ["9"] },
  { id: "technical-course", course_id: "c2", education_subsystem: "TECNICO_PROFISSIONAL",
    education_level: "SECONDARY", cycle: null, grades: ["12"] },
];
const selections = [
  { offering_id: "regular-course", template_id: "regular" },
  { offering_id: "technical-course", template_id: "technical" },
];
const recordedPeriods: RecordedPeriod[] = dates.map(([start,end],i) => ({
  numero: i+1, tipo: "TRIMESTRE", data_inicio: start, data_fim: end,
  source_template_id: "regular", source_item_id: `regular-period-${i+1}`,
  offering_id: null, peso: i===2 ? 40 : 30,
}));
const recordedEvents: RecordedEvent[] = [
  { offering_id: "regular-course", nome: "Exame REGULAR_ADULTOS", data_inicio: "2027-06-20",
    data_fim: "2027-06-24", tipo: "EXAME_ESCRITO", source_template_id: "regular", source_item_id: "regular-exam" },
  { offering_id: "technical-course", nome: "Exame TECNICO_PROFISSIONAL", data_inicio: "2027-06-20",
    data_fim: "2027-06-24", tipo: "EXAME_ESCRITO", source_template_id: "technical", source_item_id: "technical-exam" },
];
function review(overrides: Partial<Parameters<typeof reviewCanonicalCutoverTarget>[0]> = {}) {
  return reviewCanonicalCutoverTarget({
    target, calendar, profiles, offerings, selections, recordedPeriods, recordedEvents,
    ...overrides,
  });
}
test("A complete 2026/27 MED year with two distinct course exams is ready", () => {
  const result = review();
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.periods, 3);
  assert.equal(result.offerings, 2);
});
test("The dry-run rejects missing published canonical year and preserves all records", () => {
  assert.equal(review({ calendar: null }).ready, false);
  assert.deepEqual(recordedPeriods.length, 3);
});
test("The dry-run rejects mismatched year dates", () => {
  const result = review({ target: { ...target, data_inicio: "2026-08-30" } });
  assert.equal(result.ready, false);
  assert.match(result.blockers.join(), /datas do ano/);
});
test("The dry-run rejects missing, stale or unlinked trimesters", () => {
  for (const variants of [
    recordedPeriods.slice(0,2),
    recordedPeriods.map((p,i) => i===0 ? { ...p, source_item_id: null } : p),
    recordedPeriods.map((p,i) => i===0 ? { ...p, data_inicio: "2026-09-03" } : p),
    recordedPeriods.map((p,i) => i===0 ? { ...p, offering_id: offerings[0].id } : p),
  ]) assert.equal(review({ recordedPeriods: variants }).ready, false);
});
test("The dry-run rejects incomplete course profile associations", () => {
  assert.equal(review({ selections: [selections[0]] }).ready, false);
  assert.equal(review({ selections: [selections[1],selections[1]] }).ready, false);
});
test("A missing course examination or obsolete cross-course event blocks cutover", () => {
  assert.equal(review({ recordedEvents: recordedEvents.slice(0,1) }).ready, false);
  assert.equal(review({ recordedEvents: [
    ...recordedEvents,
    { ...recordedEvents[0], offering_id: "technical-course" },
  ] }).ready, false);
});
test("Official trimester provenance may originate from any compatible course profile", () => {
  const alternative = recordedPeriods.map((p,i) => ({
    ...p, source_template_id: "technical", source_item_id: `technical-period-${i+1}`,
  }));
  assert.equal(review({ recordedPeriods: alternative }).ready, true);
});
test("The dry-run route uses one year source and checks actual target sessions", () => {
  const route = readFileSync(resolve(process.cwd(),
    "src/app/api/secretaria/operacoes-academicas/virada/dry-run/route.ts"), "utf8");
  assert.match(route, /from\("calendarios_oficiais_anos"\)/);
  assert.match(route, /reviewCanonicalCutoverTarget/);
  assert.match(route, /target_calendar_checks/);
  assert.match(route, /readyCount === 0/);
  assert.doesNotMatch(route, /\.from\("calendario_templates"\)\s*\.select\("id,nome,ano_base,subsistema,versao_documento"\)/);
});

test("The dry-run rejects tampered trimester weights and examination end dates", () => {
  assert.equal(review({ recordedPeriods: recordedPeriods.map((p, i) =>
    i === 0 ? { ...p, peso: 40 } : p) }).ready, false);
  assert.equal(review({ recordedEvents: recordedEvents.map((e, i) =>
    i === 0 ? { ...e, data_fim: "2027-06-25" } : e) }).ready, false);
});
test("Course-type-specific MED events appear only for the correct curricular type", () => {
  const p = profile("regular", "REGULAR_ADULTOS");
  p.items.push({
    id: "night-course", tipo: "EXAME_ORAL", numero: null, nome: "Prova noturna",
    data_inicio: "2027-06-25", data_fim: "2027-06-25", peso: null,
    applies_to_all_offerings: false, course_types: ["NOCTURNO"],
  });
  const mapped = offerings.map((o, i) => i===0 ? { ...o, course_type: "NOCTURNO" } : o);
  assert.equal(review({ profiles: [p, profiles[1]], offerings: mapped }).ready, false);
  assert.equal(review({ profiles: [p, profiles[1]], offerings }).ready, true);
});

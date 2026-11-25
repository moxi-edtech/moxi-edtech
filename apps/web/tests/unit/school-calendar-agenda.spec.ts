import { calendarDate, eventStatus, eventCategory, isScheduledPedagogicalInterruption } from "../../src/lib/academico/calendar-agenda-presentation";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../../src/app/secretaria/(portal-secretaria)/calendario/page.tsx", import.meta.url), "utf8");

test("school calendar uses an agenda with on-demand creation and no nested event scroll", () => {
  assert.match(ui, /PORTAL_PAGE_INSET/);
  assert.match(ui, /<ModalShell open=\{open\}/);
  assert.match(ui, /Novo evento/);
  assert.match(ui, /groups\.map/);
  assert.match(ui, /divide-y divide-border/);
  assert.doesNotMatch(ui, /max-h-\[600px\]|event\.cor_hex|event\.tipo\.replace|📅|🏁|👥/);
  assert.match(ui, /Aplicável ao curso:/);
  assert.match(ui, /Evento geral do calendário académico/);
});

test("calendar keeps scoped filters and prevents concurrent reads and duplicate submits", () => {
  assert.match(ui, /params\.set\("ano_letivo_id", selectedYearId\)/);
  assert.match(ui, /params\.set\("curso_id", selectedCourseId\)/);
  assert.match(ui, /controller\.abort\(\)/);
  assert.match(ui, /if \(!active\) return/);
  assert.match(ui, /if \(submitLock\.current\) return/);
  assert.match(ui, /ano_letivo_id: effectiveYearId/);
  assert.match(ui, /fim_at: fimAt \|\| null/);
  assert.match(ui, /fimAt < inicioAt/);
  assert.match(ui, /operacoes \? "Operações" : "Secretaria"/);
});

test("civil-day events respect inclusive Luanda dates and midnight transitions", () => {
  const event = { tipo: "FERIADO", data_inicio: "2026-12-25", data_fim: "2026-12-25" };
  assert.equal(eventStatus(event, new Date("2026-12-24T22:59:59Z")), "scheduled");
  assert.equal(eventStatus(event, new Date("2026-12-24T23:00:00Z")), "ongoing");
  assert.equal(eventStatus(event, new Date("2026-12-25T22:59:59Z")), "ongoing");
  assert.equal(eventStatus(event, new Date("2026-12-25T23:00:00Z")), "finished");
  assert.equal(eventStatus({ ...event, data_fim: "2026-12-27" }, new Date("2026-12-27T15:00:00Z")), "ongoing");
  assert.equal(calendarDate("2026-02-30"), null);
  assert.equal(eventStatus({ ...event, data_fim: "2026-12-24" }, new Date("2026-12-25")), "unknown");
  assert.equal(eventStatus({ ...event, data_inicio: "invalid" }, new Date("2026-12-25")), "unknown");
});
test("timed events respect start/end instants and do not imply an all-day duration", () => {
  const event = { tipo: "EVENTO_GERAL", data_inicio: "2026-12-25T10:00:00+01:00", data_fim: "2026-12-25T11:00:00+01:00" };
  assert.equal(eventStatus(event, new Date("2026-12-25T08:59:59Z")), "scheduled");
  assert.equal(eventStatus(event, new Date("2026-12-25T09:30:00Z")), "ongoing");
  assert.equal(eventStatus(event, new Date("2026-12-25T10:00:01Z")), "finished");
  assert.equal(eventStatus({ ...event, data_fim: null }, new Date("2026-12-25T09:01:00Z")), "finished");
});
test("holiday category is independent of status and official interruption types are not expanded", () => {
  assert.equal(eventCategory("FERIADO"), "holiday");
  assert.equal(eventCategory("FERIAS_ALUNOS"), "pause");
  assert.equal(eventCategory("EXAME_ESCRITO"), "assessment");
  assert.equal(eventCategory("MATRICULA"), "enrolment");
  assert.equal(eventCategory("ENCERRAMENTO_ANO_LETIVO"), "academic");
  assert.equal(eventCategory("EVENTO_GERAL"), "school");
  assert.equal(eventCategory("UNRECOGNIZED"), "other");
  assert.equal(isScheduledPedagogicalInterruption("FERIADO"), true);
  assert.equal(isScheduledPedagogicalInterruption("PAUSA_PEDAGOGICA"), true);
  assert.equal(isScheduledPedagogicalInterruption("FERIAS_ALUNOS"), false);
  assert.equal(isScheduledPedagogicalInterruption("EVENTO_GERAL"), false);
  assert.match(ui, /eventStatus\(event, now\) !== period/);
  assert.match(ui, /eventCategory\(event.tipo\) !== category/);
  assert.match(ui, /window.clearInterval\(timer\)/);
  assert.match(ui, /Interrupção pedagógica/);
});

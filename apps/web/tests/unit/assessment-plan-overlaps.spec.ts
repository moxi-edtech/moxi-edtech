import assert from "node:assert/strict";
import test from "node:test";
import { assessmentPlanOverlaps, assessmentSlotsOverlap, type AssessmentScheduleSlot } from "../../src/lib/academico/assessment-plan-overlaps";

const event = (id: string, turma_id: string, data: string, inicio: string, fim: string | null, estado = "rascunho"): AssessmentScheduleSlot =>
  ({ id, turma_id, data, inicio, fim, estado });

test("duas disciplinas no mesmo horário da mesma turma são bloqueadas, mesmo em rascunho", () => {
  const planned = [
    event("port", "turma-a", "2026-11-20", "08:00", "09:00"),
    event("mat", "turma-a", "2026-11-20", "08:30", "09:30"),
  ];
  const clashes = assessmentPlanOverlaps(planned, []);
  assert.equal(clashes.port?.[0]?.withId, "mat");
  assert.equal(clashes.mat?.[0]?.withId, "port");
  assert.equal(clashes.port?.[0]?.source, "selection");
});

test("outra turma não bloqueia o mesmo horário; adjacência [) é permitida", () => {
  const first = event("1", "turma-a", "2026-11-20", "08:00", "09:00");
  assert.equal(assessmentSlotsOverlap(first, event("2", "turma-b", "2026-11-20", "08:30", "09:30")), false);
  assert.equal(assessmentSlotsOverlap(first, event("3", "turma-a", "2026-11-20", "09:00", "10:00")), false);
});

test("rascunhos e publicados existentes bloqueiam; cancelados não", () => {
  const next = event("new", "turma-a", "2026-11-20", "08:00", "09:00");
  const saved = [
    event("old", "turma-a", "2026-11-20", "08:15", "08:45", "publicado"),
    event("ignored", "turma-a", "2026-11-20", "08:30", "09:00", "cancelado"),
  ];
  assert.deepEqual(assessmentPlanOverlaps([next], saved).new, [{ withId: "old", source: "existing" }]);
});

test("sem fim significa 60 minutos, incluindo quando atravessa a meia-noite", () => {
  const late = event("1", "turma-a", "2026-11-20", "23:30", null);
  const after = event("2", "turma-a", "2026-11-21", "00:15", "01:00");
  assert.equal(assessmentSlotsOverlap(late, after), true);
});

test("janelas inválidas e datas malformadas não são apresentadas como colisões", () => {
  const real = event("1", "turma-a", "2026-11-20", "08:00", "09:00");
  assert.equal(assessmentSlotsOverlap(event("2", "turma-a", "2026-02-30", "08:00", "09:00"), real), false);
  assert.equal(assessmentSlotsOverlap(event("2", "turma-a", "2026-11-20", "09:00", "08:00"), real), false);
});

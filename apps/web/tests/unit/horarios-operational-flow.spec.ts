import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { slotsOverlap, resourceConflicts, type LessonSlot } from "../../src/lib/horarios/temporal-conflicts";
import { mapSlots } from "../../src/hooks/useHorarioData";

const slot = (id: string, dia_semana: number, inicio: string, fim: string): LessonSlot => ({ id, dia_semana, inicio, fim });
const slots = [
  slot("a", 1, "13:00:00", "13:45:00"),
  slot("b", 1, "13:30:00", "14:15:00"),
  slot("c", 1, "13:45:00", "14:30:00"),
  slot("d", 2, "13:00:00", "13:45:00"),
];
const byId = new Map(slots.map((s) => [s.id, s]));

test("horários: different slot IDs overlapping on the same day collide", () => {
  assert.equal(slotsOverlap(slots[0]!, slots[1]!), true);
  assert.equal(slotsOverlap(slots[0]!, slots[2]!), false);
  assert.equal(slotsOverlap(slots[0]!, slots[3]!), false);
  assert.deepEqual(resourceConflicts(
    [{ slot_id: "a", professor_id: "p", sala_id: "s" }],
    [{ slot_id: "b", professor_id: "p", sala_id: "s" }],
    byId,
  ), [
    { slot_id: "a", professor_id: "p", kind: "professor" },
    { slot_id: "a", sala_id: "s", kind: "sala" },
  ]);
});

test("horários: consecutive lessons and optional assignments do not create false conflicts", () => {
  assert.deepEqual(resourceConflicts(
    [{ slot_id: "a", professor_id: "p", sala_id: "s" }],
    [{ slot_id: "c", professor_id: "p", sala_id: "s" }, { slot_id: "b", professor_id: "other", sala_id: null }],
    byId,
  ), []);
  assert.deepEqual(resourceConflicts([{ slot_id: "a" }], [{ slot_id: "b" }], byId), []);
});

test("horários: conflict reports deduplicate same resource at the same time", () => {
  const other = { slot_id: "b", professor_id: "p" };
  assert.deepEqual(resourceConflicts([{ slot_id: "a", professor_id: "p" }], [other, other], byId),
    [{ slot_id: "a", professor_id: "p", kind: "professor" }]);
});

test("horários: interval never becomes an editable lesson slot", () => {
  const result = mapSlots([
    { ...slots[0]!, turno_id: "tarde", ordem: 1, is_intervalo: false },
    { ...slots[1]!, turno_id: "tarde", ordem: 2, is_intervalo: true },
  ]);
  assert.equal(result.slotLookup["Segunda-1"], "a");
  assert.equal(result.slotLookup["Segunda-2"], undefined);
  assert.equal(result.slots[1]?.tipo, "intervalo");
});

test("horários: editor and API guard the selected shift and incomplete reads", () => {
  const page = readFileSync("src/app/escola/[id]/(portal)/horarios/quadro/page.tsx", "utf8");
  const route = readFileSync("src/app/api/escolas/[id]/horarios/quadro/route.ts", "utf8");
  assert.match(page, /rawSlots\.filter\(\(slot\) => slot\.turno_id === turnoId\)/);
  assert.match(route, /\.eq\('turno_id', expectedShift\)/);
  assert.match(route, /count !== \(data \|\| \[\]\)\.length/);
  assert.match(route, /resourceConflicts\(payload/);
});

test("horários: published version is not a draft save target and saved version is reused", () => {
  const route = readFileSync("src/app/api/escolas/[id]/horarios/quadro/route.ts", "utf8");
  const page = readFileSync("src/app/escola/[id]/(portal)/horarios/quadro/page.tsx", "utf8");
  const version = readFileSync("src/app/api/secretaria/turmas/[id]/horario/versao/route.ts", "utf8");
  assert.match(route, /p_versao_id: sourceStatus === 'draft' \? sourceVersionId : null/);
  assert.match(page, /setVersaoId\(persistedVersion\)/);
  assert.match(version, /savedDraft\?\.id \?\? publicada\?\.id/);
});

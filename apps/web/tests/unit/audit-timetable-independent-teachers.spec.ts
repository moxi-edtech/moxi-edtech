import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { timetablePublicationState, timetableStateLabels } from "../../src/lib/horarios/timetable-publication-state";

test("os três estados dependem da versão existente, não de uma atribuição docente", () => {
  assert.equal(timetablePublicationState([]), "sem_horario");
  assert.equal(timetablePublicationState([{ id:"draft-a", status:"draft" }]), "rascunho");
  assert.equal(timetablePublicationState([
    { id:"draft-a", status:"draft" },
    { id:"pub-b", status:"publicada" },
  ]), "publicado");
  assert.match(timetableStateLabels.rascunho, /não publicado/);
});

test("a publicação aceita professor nulo e não infere atribuição no editor", () => {
  const route = readFileSync(resolve(process.cwd(), "src/app/api/escolas/[id]/horarios/quadro/route.ts"), "utf8");
  const page = readFileSync(resolve(process.cwd(), "src/components/escola/horarios/HorarioEditor.tsx"), "utf8");
  const modal = readFileSync(resolve(process.cwd(), "src/components/secretaria/TurmaHorarioModal.tsx"), "utf8");
  assert.match(route, /professor_id: z\.string\(\)\.uuid\(\)\.nullable\(\)\.optional\(\)/);
  assert.match(page, /professor_id: previous\?\.professor_id \?\? null/);
  assert.match(page, /timetableStateLabels\[horarioStatus\]/);
  assert.match(modal, /<HorarioEditor/);
  assert.match(readFileSync(resolve(process.cwd(), "src/components/escola/horarios/SchedulerBoard.tsx"), "utf8"), /Professor não indicado/);
});

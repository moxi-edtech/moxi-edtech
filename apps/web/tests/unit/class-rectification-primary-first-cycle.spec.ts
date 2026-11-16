import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isAllowedClassCorrectionTarget,
  isPrimaryToFirstCycleCorrection,
} from "../../src/lib/secretaria/class-rectification-target";

const primary6 = {
  id: "6A", classe_id: "C6", classe_num: 6, curso_id: "PRIMARY", nivel_ensino: "primario",
};
const secondary7 = {
  id: "7A", classe_id: "C7", classe_num: 7, curso_id: "SECONDARY", nivel_ensino: "secundario",
};

test("6th primary -> 7th first-cycle is a valid SAME-YEAR correction option even across courses", () => {
  assert.equal(isPrimaryToFirstCycleCorrection(primary6, secondary7), true);
  assert.equal(isAllowedClassCorrectionTarget(primary6, secondary7), true);
});

test("cannot accidentally offer unrelated inter-course corrections or a same-class transfer", () => {
  assert.equal(isAllowedClassCorrectionTarget(primary6, {...secondary7, classe_num: 8}), false);
  assert.equal(isAllowedClassCorrectionTarget({...primary6, classe_num: 5}, secondary7), false);
  assert.equal(isAllowedClassCorrectionTarget(secondary7, primary6), false);
  assert.equal(isAllowedClassCorrectionTarget(primary6, {...secondary7, nivel_ensino: "primario"}), false);
  assert.equal(isAllowedClassCorrectionTarget(primary6, {...secondary7, curso_id: null}), false);
  assert.equal(isAllowedClassCorrectionTarget(primary6, {...secondary7, classe_id: primary6.classe_id}), false);
  assert.equal(isAllowedClassCorrectionTarget(primary6, {...secondary7, id: primary6.id}), false);
  assert.equal(isAllowedClassCorrectionTarget(null, secondary7), false);
  assert.equal(isAllowedClassCorrectionTarget(primary6, {...secondary7, curso_id: primary6.curso_id}), true);
});

test("profile and Balcao consume the enrollment-scoped correction options, without generic transfer RAA", () => {
  const profile = readFileSync(new URL("../../src/components/secretaria/TransferForm.tsx", import.meta.url), "utf8");
  const balc = readFileSync(new URL("../../src/components/secretaria/BalcaoEnrollmentCorrection.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../src/app/api/secretaria/matriculas/[matriculaId]/rectify-class/route.ts", import.meta.url), "utf8");
  assert.match(profile, /isAllowedClassCorrectionTarget\(turmaAtual, turma\)/);
  assert.match(profile, /retificarClasse\s*\?\s*`\/api\/secretaria\/matriculas\//);
  assert.match(profile, /json\.matricula_id !== matriculaId/);
  assert.match(profile, /json\.turma_atual_id !== currentTurmaId/);
  assert.match(profile, /json\.ano_letivo_id !== anoLetivoId/);
  assert.match(balc, /isAllowedClassCorrectionTarget\(current, item\)/);
  assert.match(route, /\.select\("id,nome,classe_num,nivel_ensino,classe_id,curso_id,turno,capacidade_maxima"\)/);
  assert.match(route, /requireRoleInSchool/);
  assert.match(route, /\.eq\("escola_id",escolaId\)\.eq\("session_id",matricula\.session_id\)/);
  assert.match(route, /turma_transfer_academic_evidence_v1/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isPreschoolPrimaryBridge, isPrimarySecondaryBridge } from "../../src/lib/rematricula/primary-secondary-bridge";

const base = {
  sourceClass: 6,
  destinationClass: 7,
  sourceLevel: "primario",
  destinationLevel: "secundario",
  mode: "regular" as const,
};

test("6th primary to 7th secondary is a valid sequential cross-course promotion", () => {
  assert.equal(isPrimarySecondaryBridge(base), true);
  assert.equal(isPrimarySecondaryBridge({ ...base, mode: "conditional" }), true);
});

test("3rd-to-5th jump, retention and wrong education levels are never bypasses", () => {
  for (const input of [
    { ...base, sourceClass: 3, destinationClass: 5 },
    { ...base, sourceClass: 5 },
    { ...base, destinationClass: 8 },
    { ...base, mode: "repeat" as const },
    { ...base, mode: null },
    { ...base, sourceLevel: "secundario" },
    { ...base, destinationLevel: "primario" },
    { ...base, sourceLevel: null },
    { ...base, destinationClass: null },
  ]) assert.equal(isPrimarySecondaryBridge(input), false);
});

test("all three steps enforce the same school-data-scoped bridge, not generic course switching", () => {
  const route = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/balcao/rematriculas/route.ts"), "utf8");
  const turmas = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/turmas-simples/route.ts"), "utf8");
  const sql = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20271112020000_balcao_primary_secondary_6_to_7.sql"), "utf8");
  assert.match(route, /isPrimarySecondaryBridge/);
  assert.match(route, /academicEligibility\.mode/);
  assert.match(turmas, /isPrimarySecondaryBridge/);
  assert.match(turmas, /authorizeBalcaoPendingAcademicWrite/);
  assert.match(turmas, /\.eq\("escola_id", escolaId\)\.eq\("aluno_id", alunoId\)/);
  assert.match(turmas, /\.eq\("escola_id", escolaId\)\.eq\("session_id", sessionId\)/);
  assert.match(sql, /v_source_number = 6/);
  assert.match(sql, /v_numero_origem = 6/);
  assert.match(sql, /v_numero_destino = 7/);
  assert.match(sql, /v_source_turma\.nivel_ensino = 'primario'/);
  assert.match(sql, /v_target_turma\.nivel_ensino = 'secundario'/);
  assert.match(sql, /v_classe_origem\.nivel_ensino = 'primario'/);
  assert.match(sql, /v_classe_destino\.nivel_ensino = 'secundario'/);
  assert.match(sql, /NOT v_retido/);
  assert.match(sql, /resolve_raa_progression_for_matricula/);
});

test("Pré-Escolar only advances to 1st primary via documented cross-course bridge", () => {
  assert.equal(isPreschoolPrimaryBridge({
    sourceClassName: "Pré-Escolar", sourceLevel: "pre_escolar",
    destinationClass: 1, destinationLevel: "primario", mode: "regular",
  }), true);
  for (const input of [
    { sourceClassName: "Pré-Escolar", sourceLevel: "pre_escolar", destinationClass: 2, destinationLevel: "primario", mode: "regular" },
    { sourceClassName: "Pré-Escolar", sourceLevel: "pre_escolar", destinationClass: 1, destinationLevel: "secundario", mode: "regular" },
    { sourceClassName: "Pré-Escolar", sourceLevel: "pre_escolar", destinationClass: 1, destinationLevel: "primario", mode: "repeat" },
    { sourceClassName: "1ª Classe", sourceLevel: "pre_escolar", destinationClass: 1, destinationLevel: "primario", mode: "regular" },
    { sourceClassName: "Pré-Escolar", sourceLevel: "primario", destinationClass: 1, destinationLevel: "primario", mode: "regular" },
  ]) assert.equal(isPreschoolPrimaryBridge(input as Parameters<typeof isPreschoolPrimaryBridge>[0]), false);
});

test("all boundaries require canonical eligible source, stage and strict replay scope", () => {
  const sql = readFileSync(resolve(process.cwd(),
    "../../supabase/migrations/20271119121000_balcao_rematricula_transicoes_idempotentes.sql"), "utf8");
  const route = readFileSync(resolve(process.cwd(),
    "src/app/api/secretaria/balcao/rematriculas/route.ts"), "utf8");
  const classes = readFileSync(resolve(process.cwd(),
    "src/app/api/secretaria/turmas-simples/route.ts"), "utf8");
  assert.match(sql, /dc\.numero=7/);
  assert.match(sql, /ay\.ano=src\.ano_letivo\+1 AND ay\.ativo/);
  assert.match(sql, /v_terminale := false/);
  assert.match(sql, /v_classe_origem\.nome='Pré-Escolar'/);
  assert.match(sql, /v_classe_destino\.nivel_ensino='primario'/);
  assert.match(sql, /v_destino\.turma_id=p_destino_turma_id/);
  assert.match(sql, /sp\.contexto->>'origem_matricula_id'=p_matricula_origem_id::text/);
  assert.match(sql, /sp\.status='granted'/);
  assert.match(sql, /PERFORM public\._assert_rematricula_payment_proof/);
  assert.match(sql, /'diretor'/);
  assert.match(route, /isPreschoolPrimaryBridge/);
  assert.match(route, /preEscolarOrigem/);
  assert.match(classes, /origemPreEscolar/);
  assert.match(classes, /isPreschoolPrimaryBridge/);
});

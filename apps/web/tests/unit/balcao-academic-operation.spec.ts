import test from "node:test";
import assert from "node:assert/strict";
import { balcaoAcademicOperation, canManageBalcaoAcademic } from "../../src/lib/rematricula/balcao-academic-operation";
import { resolveRaaDecretoEligibility } from "../../src/lib/academico/raa-decreto-eligibility";

const source = "60000000-0000-4000-8000-000000000001";
const discipline = "70000000-0000-4000-8000-000000000001";
const evidence = { acao: "registar_eja", matricula_id: source, motivo: "Avaliação confirmada na ata oficial", disciplina_id: discipline,
  suficiente: false, documento_fonte: "ATA-2026-01", expected_id: null };

test("negative qualitative evidence stays negative; numeric grades cannot masquerade as qualitative evidence", () => {
  const accepted = balcaoAcademicOperation.parse(evidence);
  assert.equal(accepted.acao, "registar_eja");
  assert.equal((accepted as typeof evidence).suficiente, false);
  for (const suficiente of [1, 10, "true", "false", null, undefined]) {
    assert.equal(balcaoAcademicOperation.safeParse({ ...evidence, suficiente }).success, false);
  }
});

test("caller cannot choose a school, writer, administrative state or approval role", () => {
  for (const extra of [{ escola_id: source }, { registado_por: source }, { status: "ativo" }, { service_role: true }, { papel: "diretor" }]) {
    assert.equal(balcaoAcademicOperation.safeParse({ ...evidence, ...extra }).success, false);
  }
  for (const role of [null, "professor", "financeiro", "admin_financeiro", "staff_admin", "super_admin", { papel: "diretor" }]) assert.equal(canManageBalcaoAcademic(role), false);
  for (const role of ["diretor", "admin", "admin_escola", "secretaria", "admin_secretaria", "secretaria_financeiro"]) assert.equal(canManageBalcaoAcademic(role), true);
});

test("a new evidence and a rectification both require source, reason and expected version", () => {
  for (const extra of [{ motivo: "ok" }, { documento_fonte: "" }, { expected_id: undefined }, { expected_id: "latest" }]) {
    assert.equal(balcaoAcademicOperation.safeParse({ ...evidence, ...extra }).success, false);
  }
  assert.equal(balcaoAcademicOperation.safeParse({ ...evidence, expected_id: discipline }).success, true);
});

test("qualitative EJA uses official attendance and never interprets missing attendance as a recorded failure", () => {
  const disciplines = [{ id: discipline, nome: "Área", suficiente: true }];
  const input = { regime: "eja_modulo_1" as const, disciplinas: disciplines };
  assert.equal(resolveRaaDecretoEligibility(input).decision, "pendente_dados");
  assert.equal(resolveRaaDecretoEligibility({ ...input, frequenciaAnual: { aulasFrequentadas: 60, aulasPrevistas: 90 } }).decision, "transitou");
  assert.equal(resolveRaaDecretoEligibility({ ...input, frequenciaAnual: { aulasFrequentadas: 59, aulasPrevistas: 90 } }).decision, "reprovado_por_faltas");
  assert.equal(resolveRaaDecretoEligibility({ ...input, disciplinas: [{ ...disciplines[0], suficiente: false }], frequenciaAnual: { aulasFrequentadas: 90, aulasPrevistas: 90 } }).decision, "reprovado");
  for (const frequency of [{ aulasFrequentadas: -1, aulasPrevistas: 90 }, { aulasFrequentadas: 91, aulasPrevistas: 90 }, { aulasFrequentadas: NaN, aulasPrevistas: 90 }]) {
    assert.equal(resolveRaaDecretoEligibility({ ...input, frequenciaAnual: frequency }).decision, "pendente_dados");
  }
});


test("extraordinary exams can be scheduled for the conditional classes already supported by RAA", async () => {
  const { canScheduleRaaExam } = await import("../../src/lib/academico/raa-exam-session-policy");
  for (const classe_num of [7, 8, 10, 11]) {
    const regime = { classe_num, nivel_ensino: "secundario", ano_numero: null, eh_classe_exame: false, exames_aplicaveis: [] };
    assert.equal(canScheduleRaaExam(regime, "extraordinario"), true);
    assert.equal(canScheduleRaaExam(regime, "exame_nacional"), false);
  }
  assert.equal(canScheduleRaaExam({ classe_num: null, nivel_ensino: "eja", ano_numero: 1, eh_classe_exame: false, exames_aplicaveis: [] }, "extraordinario"), true);
  assert.equal(canScheduleRaaExam({ classe_num: 5, nivel_ensino: "primario", ano_numero: null, eh_classe_exame: false, exames_aplicaveis: [] }, "extraordinario"), false);
});


test("primary and numeric EJA module 3 preserve the canonical zero-to-ten cutoff", () => {
  for (const regime of ["classe_6", "eja_modulo_3"] as const) {
    const input = { regime, dadosCompletos: true, disciplinas: [{ id: discipline, nome: "Português", notaFinal: 5 }] };
    assert.equal(resolveRaaDecretoEligibility(input).decision, "concluiu");
    assert.notEqual(resolveRaaDecretoEligibility({ ...input, disciplinas: [{ ...input.disciplinas[0], notaFinal: 4 }] }).decision, "concluiu");
  }
});

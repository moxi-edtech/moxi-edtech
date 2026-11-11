import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveStudentYearSituation, hasHistoricalPending, type SituacaoBalcaoPayload, type SituacaoBalcaoRow } from "../../src/lib/balcao/student-year-situation";

const row = (year: number, status: SituacaoBalcaoRow["situacao_contextual"],
  resultado: SituacaoBalcaoRow["situacao_resultado"] = "sem_resultado_oficial"): SituacaoBalcaoRow => ({
  matricula_id: "matricula-" + year, escola_id: "escola", aluno_id: "aluno",
  ano_letivo: year, ano_letivo_id: "ano-" + year, turma_id: "turma-" + year,
  status_persistido: status === "matriculado" ? "ativo" : "pendente",
  situacao_contextual: status, situacao_resultado: resultado,
  acao_contextual: "conciliar_historico", resultado_oficial: resultado === "homologado" ? "aprovado" : null,
});
const payload = (current: SituacaoBalcaoRow | null, previous: SituacaoBalcaoRow | null = null,
  active = true): SituacaoBalcaoPayload => ({
  ok: true, aluno_id: "aluno",
  ano: { id: "ano-2026", ano: 2026, label: "2026/2027", ativo: active, arquivado_com_pendencias: !active },
  current, previous, can_write_current_grades: true,
});

test("existing current enrollment never requires a fabricated prior-year enrollment", () => {
  const situacao = resolveStudentYearSituation(payload(row(2026, "matriculado")));
  assert.match(situacao.title, /Matriculado/);
  assert.equal(situacao.action, "grade");
});

test("a student without 2026 enrollment can continue the existing academic transition", () => {
  const situacao = resolveStudentYearSituation(payload(null, row(2025, "regularizacao_historica")));
  assert.match(situacao.title, /Sem matrícula/);
  assert.equal(situacao.action, "reenrollment");
  assert.ok(hasHistoricalPending(payload(null, row(2025, "regularizacao_historica"))));
});

test("historic pending and enrolled destination coexist; neither is silently approved", () => {
  const state = payload(row(2026, "matriculado"), row(2025, "regularizacao_historica"));
  assert.equal(resolveStudentYearSituation(state).action, "grade");
  assert.equal(hasHistoricalPending(state), true);
  assert.equal(state.previous?.situacao_resultado, "sem_resultado_oficial");
});

test("closed previous year with unhomologated result still offers historical resolution", () => {
  assert.equal(hasHistoricalPending(payload(row(2026, "matriculado"), row(2025, "ano_encerrado", "registado_nao_homologado"))), true);
  assert.equal(hasHistoricalPending(payload(row(2026, "matriculado"), row(2025, "ano_encerrado", "homologado"))), false);
});

test("archived year forbids normal grade entry even with operationally active enrollment", () => {
  assert.equal(resolveStudentYearSituation(payload(row(2026, "matriculado"), null, false)).action, "profile");
});

test("pending current enrollment is resumed, never duplicated", () => {
  const situacao = resolveStudentYearSituation(payload(row(2026, "aguarda_confirmacao")));
  assert.equal(situacao.action, "enrollment");
  assert.match(situacao.description, /sem criar outra matrícula/);
});

test("historic archive and completed year do not imply official academic approval", () => {
  const data = payload(row(2025, "regularizacao_historica"), null, false);
  assert.equal(resolveStudentYearSituation(data).action, "historical");
  assert.equal(resolveStudentYearSituation(payload(row(2025, "ano_encerrado"), null, false)).action, "historical");
  assert.equal(resolveStudentYearSituation(payload(row(2025, "ano_encerrado", "homologado"), null, false)).action, "profile");
});

test("transferred or inconsistent enrollment offers review, not reenrollment by assumption", () => {
  assert.equal(resolveStudentYearSituation(payload(row(2026, "transferido"))).action, "profile");
  assert.equal(resolveStudentYearSituation(payload(row(2026, "revisao_integridade"))).action, "profile");
});

test("server enforces tenant, user, selected academic year, RLS view and no-store", () => {
  const src = readFileSync(resolve(process.cwd(), "src/app/api/secretaria/balcao/situacao-academica/route.ts"), "utf8");
  for (const guard of [
    "resolveEscolaIdForUser", "requireRoleInSchool", "resolveAcademicYearContext",
    'from("v_student_lifecycle_status_v2")', '.eq("escola_id", escolaId)',
    '.eq("aluno_id", alunoId)', "DUPLICATE_YEAR_ENROLLMENT", 'force-dynamic',
    'Cache-Control', "authorizeTurmasManage",
  ]) assert.ok(src.includes(guard), guard + " must be present");
  assert.doesNotMatch(src, /service.role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Balcao navigates by current year and suppresses misleading origin-only screen", () => {
  const src = readFileSync(resolve(process.cwd(), "src/components/secretaria/BalcaoAtendimento.tsx"), "utf8");
  assert.match(src, /useBalcaoSituacaoAcademica/);
  assert.match(src, /<BalcaoSituacaoAcademica/);
  assert.match(src, /view !== "reenrollment" \|\| Boolean\(dossier\.aluno\.matricula_id\)/);
  assert.match(src, /historicalMatriculaId: row\.matricula_id/);
});

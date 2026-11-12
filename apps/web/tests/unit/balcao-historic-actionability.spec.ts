import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../../supabase/migrations/20271109040000_balcao_historic_recovery_requests.sql");
const staffMigration = read("../../../../supabase/migrations/20271112010000_balcao_historic_full_staff_permissions.sql");
const api = read("../../src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts");
const ui = read("../../src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx");
const balc = read("../../src/components/secretaria/BalcaoAtendimento.tsx");

test("historic requests remain scoped to an enrolled student with school-level RLS and idempotency", () => {
  assert.match(migration, /solicitar_regularizacao_historica_balcao/);
  assert.match(migration, /admin_financeiro/);
  assert.match(migration, /BALCAO_REGULARIZACAO_ACADEMICA_SOLICITADA/);
  assert.match(migration, /INSERT INTO public\.notificacoes/);
  assert.match(migration, /'\/secretaria\/balcao\?alunoId='/);
  assert.match(migration, /eu\.papel IN \('admin','admin_escola','staff_admin','diretor'\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public.balcao_historic_recovery_requests/);
  assert.match(migration, /ON CONFLICT \(escola_id,matricula_id\) WHERE status='pendente' DO NOTHING/);
  assert.doesNotMatch(migration, /INSERT INTO public\.notas/);
  assert.doesNotMatch(migration, /UPDATE public\.anos_letivos/);
});

test("the selected student can submit and review the actual audited school request", () => {
  assert.match(api, /acao: z\.literal\("solicitar_intervencao"\)/);
  assert.match(api, /solicitar_regularizacao_historica_balcao/);
  assert.match(api, /balcao_historic_recovery_requests/);
  assert.match(api, /pedido_regularizacao: recoveryRequest/);
  assert.match(ui, /Registar pedido/);
  assert.match(ui, /requestIntervention\(\)/);
  assert.match(ui, /snapshot\.pedido_regularizacao/);
  assert.match(ui, /needsIntervention/);
});

test("authorized academic role sees named source disciplines and direct grade actions", () => {
  assert.match(ui, /Disciplinas da origem/);
  assert.match(ui, /onLancarNotaHistorica\(item\.id\)/);
  assert.match(ui, /snapshot\.permite_notas_historicas/);
  assert.match(balc, /disciplinasPendentes=\{/);
  assert.match(balc, /initialDisciplinaId: disciplinaId/);
});

test("four authorized staff profiles can finish the same audited academic workflow", () => {
  const auth = read("../../src/lib/academico/authorize-balcao-academic-write.ts");
  for (const role of ["secretaria","admin","admin_financeiro","admin_secretaria","admin_secretario"]) {
    assert.ok(auth.includes('"' + role + '"'), role + " must be recognized");
    assert.ok(staffMigration.includes("'" + role + "'"), role + " must be admitted by SQL");
  }
  for (const functionName of [
    "lancar_nota_historica_individual", "lancar_notas_batch",
    "finalizar_origem_academica", "ratificar_resultado_historico_escola",
    "historico_set_snapshot_state", "resolve_raa_progression_for_matricula",
  ]) assert.match(staffMigration, new RegExp("FUNCTION public\\." + functionName));
  assert.match(api, /const WriteRoles = BALCAO_HISTORIC_OPERATOR_ROLES/);
  assert.match(api, /const ExactHistoricalDecisionRoles = new Set<string>\(BALCAO_HISTORIC_OPERATOR_ROLES\)/);
  assert.match(staffMigration, /current_tenant_escola_id/);
  assert.match(staffMigration, /eu\.user_id\s*=\s*v_actor/);
  assert.match(staffMigration, /MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO/);
});

test("all authorized staff can read one selected student's disciplines and pauta without class-management permission", () => {
  const d = read("../../src/app/api/secretaria/turmas/[id]/disciplinas/route.ts");
  const p = read("../../src/app/api/secretaria/turmas/[id]/pauta-grid/route.ts");
  const modal = read("../../src/components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(d, /authorizeBalcaoPendingAcademicWrite/);
  assert.match(d, /\.eq\('escola_id', escolaId\)\.eq\('aluno_id', alunoId\)/);
  assert.match(d, /\.eq\('turma_id', turmaId\)\.eq\('session_id', anoLetivoId\)/);
  assert.match(p, /Boolean\(parsed\.data\.alunoId && parsed\.data\.anoLetivoId\)/);
  assert.match(p, /!authz\.allowed && !canPreviewPending/);
  assert.match(p, /\.eq\('aluno_id', parsed\.data\.alunoId\)/);
  assert.match(modal, /new URLSearchParams\(\{ aluno_id: alunoId, ano_letivo_id: academicYearId \}\)/);
  assert.match(modal, /Tentar novamente/);
});

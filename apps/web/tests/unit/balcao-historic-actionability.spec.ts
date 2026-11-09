import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../../supabase/migrations/20271109040000_balcao_historic_recovery_requests.sql");
const api = read("../../src/app/api/secretaria/operacoes-academicas/reconciliacao-historica/route.ts");
const ui = read("../../src/components/secretaria/BalcaoHistoricalAcademicRecovery.tsx");
const balc = read("../../src/components/secretaria/BalcaoAtendimento.tsx");

test("financial staff can request academic action but cannot gain power to write marks or sign a result", () => {
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
  assert.match(ui, /Registar pedido à direção/);
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

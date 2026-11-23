import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
const portal = source("components/aluno/tabs/TabFinanceiro.tsx");
const apiAluno = source("app/api/aluno/financeiro/route.ts");
const gestao = source("components/aluno/BolsaIntegralCard.tsx");
const apiGestao = source("app/api/secretaria/alunos/[id]/bolsa/route.ts");

test("portal do aluno mostra bolsa SSOT e nunca transforma isento em pendente", () => {
  assert.match(portal, /value === "isento"\) return "isento"/);
  assert.match(portal, /value === "cancelado"\) return "cancelado"/);
  assert.match(portal, /Bolsa integral de estudo/);
  assert.match(portal, /item\.status === "isento"/);
  assert.match(portal, /item\.status === "cancelado"/);
  assert.match(portal, /item\.valor > 0 \?/);
  assert.match(portal, /\["pendente", "atrasado", "pago_parcial"\]/);
  assert.match(portal, /Pago parcialmente · saldo isento/);
  assert.match(apiAluno, /bolsa_isencao_integral/);
  assert.match(apiAluno, /\.eq\("aluno_id", alunoId\)/);
  assert.match(apiAluno, /\.eq\("escola_id", ctx\.escolaId\)/);
  assert.match(apiAluno, /bolsas: \(matriculasBolsa/);
});

test("isenções são créditos, não pagamentos e não criam recibos artificiais", () => {
  assert.match(apiAluno, /m\.referencia_tabela === "pagamentos"/);
  assert.match(apiAluno, /total_pago: totalPagoReal/);
  assert.match(portal, /Sem novo recibo de pagamento/);
  assert.match(portal, /item\.recibo_id/);
  assert.match(portal, /<StudentAppyPayButton/);
  assert.match(portal, /<PaymentDrawer/);
});

test("gestão retroativa é explícita, justificada e limitada à matrícula", () => {
  assert.match(gestao, /Regularizar propinas anteriores/);
  assert.match(gestao, /regularizacao_retroativa: retroativa/);
  assert.match(gestao, /justificativa: retroativa \? justificativa\.trim\(\) : null/);
  assert.match(gestao, /justificativa\.trim\(\)\.length < 10/);
  assert.match(gestao, /bolsa-justificativa/);
  assert.match(gestao, /mesVigencia/);
  assert.match(apiGestao, /\.eq\("escola_id", ctx\.escolaId\)/);
  assert.match(apiGestao, /p_regularizacao_retroativa/);
  assert.match(apiGestao, /p_justificativa/);
  assert.match(apiGestao, /\.eq\("aluno_id",id\)/);
});

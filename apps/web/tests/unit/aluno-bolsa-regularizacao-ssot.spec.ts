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

const admissao = source("components/secretaria/AdmissaoWizardClient.tsx");
const perfil = source("components/aluno/AlunoPerfilPage.tsx");
const conciliacaoApi = source("app/api/financeiro/relatorios/reconciliacao-mensalidades/route.ts");
const migration = readFileSync(new URL("../../../../supabase/migrations/20271202030000_bolsa_integral_matricula_ssot.sql", import.meta.url), "utf8");

test("admissão permite bolsa integral antes da geração do carnet e bloqueia avanço durante salvamento", () => {
  assert.match(admissao, /Bolsa integral de estudo/);
  assert.match(admissao, /percentagemDesconto: 100, motivoDesconto: "Bolsa integral"/);
  assert.match(admissao, /!saving && !error/);
  assert.match(migration, /AFTER UPDATE OF status, matricula_id ON public.candidaturas/);
  assert.match(migration, /classe.*bolsa_admissao|klasse_bolsa_candidatura_matriculada/);
  assert.match(migration, /NEW.status <> 'matriculado'/);
  assert.match(migration, /NEW.aluno_id/);
});

test("a gestão da bolsa aparece no financeiro com prévia e histórico por matrícula", () => {
  assert.match(perfil, /slotFinanceiro=/);
  assert.match(perfil, /<BolsaIntegralCard/);
  assert.match(gestao, /Prévia antes de confirmar/);
  assert.match(gestao, /previsao_incompleta/);
  assert.match(gestao, /Histórico da bolsa/);
  assert.match(apiGestao, /\.eq\("entity_id", atual.id\)/);
  assert.match(apiGestao, /\.eq\("escola_id", ctx.escolaId\)/);
  assert.match(apiGestao, /"pagamentos"\)\.select\("mensalidade_id,status,valor_pago,status_fiscal,fiscal_documento_id"\)/);
  assert.match(conciliacaoApi, /\.eq\("aluno_id", alunoId\)/);
  assert.match(portal, /bolsaVigente/);
  assert.match(portal, /Histórico de bolsas/);
});


test("bolsa percentual: barra e campo exacto partilham estado; a RPC calcula o valor definitivo", () => {
  assert.match(gestao, /type="range" min="0.01" max="99.99" step="0.01" value=\{valorBarra\}/);
  assert.match(gestao, /type="number" inputMode="decimal" min="0.01" max="99.99" step="0.01" value=\{percentagem\}/);
  assert.match(gestao, /aria-valuetext=/);
  assert.match(gestao, /onChange=\{e => setPercentagem\(e.target.value\)\}/);
  assert.match(gestao, /percentagem: taxa/);
  assert.match(gestao, /O valor definitivo é calculado e validado no servidor/);
  assert.match(apiGestao, /klasse_definir_bolsa_parcial/);
  assert.match(apiGestao, /p_percentagem: parsed.data.percentagem/);
});


test("percentual refinado mantém entrada precisa e indica a parcela a pagar", () => {
  assert.match(gestao, /pointer-events-none absolute inset-x-2\.5 h-1\.5/);
  assert.match(gestao, /Percentual a pagar/);
  assert.match(gestao, /aria-pressed=\{taxaValida && taxa === valor\}/);
  assert.match(gestao, /aria-describedby=\{\x60\$\{percentagemId\}-ajuda\x60\}/);
});

test("a linha financeira usa o estado de vencimento partilhado e não mostra atraso após liquidar", () => {
  const row = source("components/aluno/DossierSeccoes.tsx");
  assert.match(row, /const \{ open, days, overdue \} = mensalidadeDueState\(m\)/);
  assert.match(row, /const vencimentoInfo = overdue && days !== null/);
  assert.match(row, /m.status === "pago" && m.pago_em/);
  assert.match(row, /\{open && \(/);
});

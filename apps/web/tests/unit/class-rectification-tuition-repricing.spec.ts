import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../../../supabase/migrations/20271116090000_balcao_retificacao_classe_repreco_pendentes.sql", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../../src/app/api/secretaria/matriculas/[matriculaId]/rectify-class/route.ts", import.meta.url),
  "utf8",
);

test("class correction atomically locks enrollment and bills before repricing", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.retificar_classe_matricula/);
  assert.match(migration, /SECURITY DEFINER SET search_path = ''/);
  assert.match(migration, /public\.current_tenant_escola_id\(\)/);
  assert.match(migration, /public\.user_has_role_in_school/);
  assert.match(migration, /WHERE id=p_matricula_id AND escola_id=v_escola FOR UPDATE/);
  assert.match(migration, /ORDER BY mn\.id FOR UPDATE/);
  assert.match(migration, /public\.balcao_pauta_turma_correction_nonce/);
  assert.ok(migration.indexOf("ORDER BY mn.id FOR UPDATE") < migration.indexOf("UPDATE public.matriculas SET turma_id"));
  assert.ok(migration.indexOf("UPDATE public.matriculas SET turma_id") < migration.indexOf("UPDATE public.mensalidades mn SET"));
  assert.match(migration, /v_reprecificadas <> v_elegiveis/);
  assert.match(migration, /v_historico_apos IS DISTINCT FROM v_historico/);
  assert.match(migration, /USING ERRCODE='40001'/);
});

test("target tuition always resolves within the same school, academic year, course and class", () => {
  for (const guard of [
    "ft.escola_id = v_escola",
    "ft.ano_letivo = v_m.ano_letivo",
    "ft.session_id = v_m.session_id",
    "ft.curso_id = v_destino.curso_id",
    "ft.classe_id = v_destino.classe_id",
    "v_tabela_destino IS NULL",
    "USING ERRCODE='P1051'",
  ]) assert.ok(migration.includes(guard), guard);
  assert.doesNotMatch(migration, /ano_letivo\s*<=\s*v_m\.ano_letivo/);
});

test("only untouched unpaid monthly installments can change, never paid, cancelled or discounted amounts", () => {
  for (const guard of [
    "mn.status IN ('pendente','atrasado')",
    "coalesce(mn.valor_pago_total,0) = 0",
    "coalesce(mn.desconto_aplicado,0) = 0",
    "coalesce(v_m.percentagem_desconto,0) = 0",
    "original.valor_mensalidade = mn.valor",
    "original.classe_id = v_origem.classe_id",
    "public.financeiro_contratos",
    "public.pagamentos p",
    "public.financeiro_cobrancas c",
    "public.documentos_emitidos d",
    "public.pagamento_intents pi",
    "valor_original = v_valor_destino",
    "tabela_id = v_tabela_destino",
    "turma_id = v_destino.id",
  ]) assert.ok(migration.includes(guard), guard);
  assert.doesNotMatch(migration, /\bUPDATE public\.(?:pagamentos|documentos_emitidos|pagamento_intents|financeiro_ledger|financeiro_lancamentos)\b/i);
  assert.doesNotMatch(migration, /\bDELETE FROM public\.(?:mensalidades|pagamentos|documentos_emitidos|financeiro_ledger)\b/i);
  assert.match(migration, /mensalidades_reprecificadas/);
  assert.match(migration, /mensalidades_para_revisao/);
});

test("server previews the actual behavior instead of promising that prices never change", () => {
  assert.match(route, /mensalidades pendentes elegíveis ao preço da classe destino/);
  assert.match(route, /propinas pendentes sem pagamentos, descontos ou cobranças iniciadas/);
  assert.match(route, /retificar_classe_matricula/);
  assert.match(route, /requireRoleInSchool/);
  assert.match(route, /assertAcademicYearEntity/);
});

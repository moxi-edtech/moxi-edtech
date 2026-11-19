import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../../supabase/migrations/20271117190000_curtume_fechar_pautas_2025_lote.sql");
const route = read("../../src/app/api/secretaria/operacoes-academicas/fecho-historico-lote/route.ts");
const component = read("../../src/components/secretaria/CurtumeFechoHistoricoLote.tsx");
const page = read("../../src/app/secretaria/(portal-secretaria)/operacoes-academicas/page.tsx");
const historicPage = read("../../src/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");

test("historic school year is the only mutable scope; admission and grade tables remain read-only", () => {
  assert.match(sql, /h\.escola_id=p_escola_id AND h\.ano_letivo=2025/);
  assert.match(sql, /p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'/);
  assert.match(sql, /h\.snapshot_status='aberto'/);
  assert.match(sql, /hd\.historico_ano_id=v_row\.historico_id/);
  assert.doesNotMatch(sql, /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?public\.(?:notas|matriculas|financeiro_|mensalidades|turma_disciplinas|curso_matriz)/i);
  assert.match(sql, /'pauta_fisica_excel','pauta_oficial_excel'/);
  assert.match(sql, /'pauta_escola_transcrita'/);
});

test("PostgreSQL checks school, exact academic director, source year, note bounds and source identity", () => {
  assert.match(sql, /v_actor uuid := public\.safe_auth_uid\(\)/);
  assert.match(sql, /current_tenant_escola_id\(\)/);
  assert.match(sql, /'admin','admin_escola','diretor'/);
  assert.match(sql, /NOT BETWEEN 1 AND 30/);
  assert.match(sql, /'2025','2025\/2026'/);
  assert.match(sql, /nota_final > COALESCE/);
  assert.match(sql, /numero_processo/);
  assert.match(sql, /DISCIPLINA_DUPLICADA_NA_PAUTA/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.curtume_fechar_pautas_2025_lote/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.curtume_fechar_pautas_2025_lote/);
});

test("one pupil's failure rolls back their ratification and lock without rejecting valid classmates", () => {
  assert.match(sql, /BEGIN\s+IF v_row\.status/);
  assert.match(sql, /PERFORM public\.ratificar_resultado_historico_escola/);
  assert.match(sql, /PERFORM public\.historico_set_snapshot_state/);
  assert.match(sql, /v_raa := public\.resolve_raa_progression_for_matricula/);
  assert.match(sql, /EXCEPTION WHEN OTHERS THEN/);
  assert.match(sql, /RAA_RESULTADO_NAO_RECONHECIDO/);
  assert.match(sql, /NOTAS_OPERACIONAIS_EXIGEM_RECONCILIACAO/);
});

test("API takes tenant and actor only from authenticated session; paging is bounded", () => {
  assert.match(route, /db\.auth\.getUser\(\)/);
  assert.match(route, /resolveEscolaIdForUser\(db, user\.id\)/);
  assert.match(route, /ROLES\.has\(String\(membership\?\.papel/);
  assert.match(route, /\.eq\("escola_id", CURTUME\)/);
  assert.match(route, /\.eq\("snapshot_status", "aberto"\)/);
  assert.match(route, /confirmacao: z\.literal\("CONFIRMO_PAUTAS_2025"\)/);
  assert.match(route, /p_limite: 25/);
  assert.match(route, /\.rpc\("curtume_fechar_pautas_2025_lote"/);
});

test("Director has one confirmation and may see only the real exceptions", () => {
  assert.match(component, /window\.confirm\(/);
  assert.match(component, /MAX_PAGES = 40/);
  assert.match(component, /crypto\.randomUUID\(\)/);
  assert.match(component, /Concluir históricos elegíveis/);
  assert.match(component, /pendencias\.map/);
  assert.match(component, /getHistoricBatchIssueAdvice\(issue\.codigo\)/);
  assert.match(component, /issue\.aluno_nome/);
  assert.match(component, /Resolver na Reconciliação/);
  assert.match(route, /enrichBlockingIssues\(ctx\.db, \(rawIssues as HistoricIssue\[\]\)/);
  assert.match(route, /\.eq\("ano_letivo", 2025\)/);
  assert.match(route, /\.eq\("snapshot_status", "aberto"\)/);
  assert.match(route, /\.eq\("escola_id", CURTUME\)/);
  assert.match(page, /<CurtumeFechoHistoricoLote balcaoHref=\{buildPortalHref\(escolaParam, "\/secretaria\/balcao"\)\} \/>/);
  assert.match(historicPage, /<CurtumeFechoHistoricoLote/);
  assert.match(historicPage, /isCurtume && ano === 2025 && tipo === "historicos"/);
  assert.match(historicPage, /onComplete=\{\(\) => setReload\(/);
  assert.match(page, /Rever apenas os históricos com pendências/);
  assert.match(page, /escolaId === "3744879f-2e19-4671-8995-78604302d8c5"/);
  assert.match(page, /buildPortalHref\(escolaParam, "\/operacoes\/academico\/reconciliacao-historica\?tipo=historicos&ano=2025"\)/);
  assert.match(component, /onComplete\?: \(\) => void/);
});

test("financeiro autorizado acede ao mesmo lote, com escola estrita e ratificação auditada", () => {
  assert.match(route, /const ROLES = new Set\(\["admin", "admin_escola", "diretor", "admin_financeiro"\]\)/);
  assert.match(route, /\.eq\("escola_id", CURTUME\)\.eq\("user_id", user\.id\)/);
  assert.match(route, /\.rpc\("curtume_fechar_pautas_2025_lote"/);
  const migration = read("../../../../supabase/migrations/20271118090000_curtume_2025_lote_admin_financeiro.sql");
  assert.match(migration, /curtume_fechar_pautas_2025_lote/);
  assert.match(migration, /curtume_2025_conferir_notas_documentais/);
  assert.match(migration, /curtume_2025_transcrever_pauta_fisica/);
  assert.match(migration, /curtume_2025_regularizar_origem_documental/);
  assert.match(migration, /curtume_2025_status_conferencia/);
  assert.match(migration, /v_old_count IS DISTINCT FROM 1/);
  assert.match(migration, /admin_financeiro/);
  assert.doesNotMatch(migration, /DISABLE TRIGGER|DISABLE ROW LEVEL SECURITY|service_role/i);
});

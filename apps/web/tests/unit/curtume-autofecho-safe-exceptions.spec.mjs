import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = (file) => readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8");
const sql = readFileSync(new URL(
  "../../../../supabase/migrations/20271201100000_curtume_2025_autofecho_proteger_ano_documental.sql",
  import.meta.url), "utf8");

test("preview never presents undiagnosed histories as school faults", () => {
  const api = src("app/api/secretaria/operacoes-academicas/fecho-historico-lote/route.ts");
  assert.match(api, /const unresolved = issues\.filter/);
  assert.match(api, /const actualFailures = issues\.filter/);
  assert.match(api, /actualFailures\.slice\(0, 80\)/);
  assert.match(api, /sem_diagnostico: unresolved\.length/);
  assert.match(api, /excecoes_identificadas: actualFailures\.length/);
  assert.doesNotMatch(api, /issues\.slice\(0, 80\)\.map\(\(entry\) => \(\{[\s\S]{0,120}codigo: entry\.codigo \?\? "SEM_DIAGNOSTICO"/);
});

test("one intentional authorized action does all paginated closure; no silent write on page load", () => {
  const widget = src("components/secretaria/CurtumeFechoHistoricoLote.tsx");
  const api = src("app/api/secretaria/operacoes-academicas/fecho-historico-lote/route.ts");
  assert.match(widget, /onClick=\{\(\) => void concluir\(\)\}/);
  assert.match(widget, /Resolver elegíveis automaticamente/);
  assert.match(widget, /runningRef\.current = true/);
  assert.match(widget, /MAX_PAGES = 40/);
  assert.match(widget, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(widget, /window\.confirm\(/);
  assert.match(api, /confirmacao: z\.literal\("CONFIRMO_PAUTAS_2025"\)/);
  assert.match(api, /p_limite: 25/);
  assert.match(api, /\.rpc\("curtume_fechar_pautas_2025_lote"/);
  assert.match(api, /new URL\(request\.url\)\.origin/);
  assert.match(api, /application\/json/);
  assert.doesNotMatch(api, /service_role|createAdminClient/i);
});

test("only original year contradictions require documentary decision, not fictitious grades", () => {
  const advice = src("lib/academico/curtume-historic-batch-issues.ts");
  assert.match(sql, /480edb93d338672e9a6df2dee0a5d72a/);
  assert.match(sql, /CURTUME_2025_BATCH_SOURCE_DRIFT/);
  assert.match(sql, /PAUTA_ANO_DIVERGENTE_EXIGE_CONFERENCIA/);
  assert.match(sql, /historico_ano_id=v_row\.historico_id/);
  assert.match(sql, /ano_referencia_confirmado'='2025\/2026'/);
  assert.match(sql, /EXECUTE pg_catalog\.replace\(v_definition,v_old,v_new\)/);
  assert.match(advice, /PAUTA_ANO_DIVERGENTE_EXIGE_CONFERENCIA/);
  assert.match(advice, /Confirme a pauta original/);
  assert.doesNotMatch(sql, /\bUPDATE\s+public\.(?:notas|matriculas|historico_anos|historico_disciplinas)\b/i);
  assert.doesNotMatch(sql, /DISABLE TRIGGER|TRUNCATE/);
});

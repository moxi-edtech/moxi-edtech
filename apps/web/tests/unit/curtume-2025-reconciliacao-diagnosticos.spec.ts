import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../../supabase/migrations/20271118110000_curtume_2025_persist_fecho_diagnostics.sql");
const api = read("../../src/app/api/secretaria/operacoes-academicas/fecho-historico-lote/route.ts");
const batch = read("../../src/components/secretaria/CurtumeFechoHistoricoLote.tsx");
const desk = read("../../src/components/secretaria/CurtumeHistoricalExceptionDesk.tsx");
const page = read("../../src/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");
const advice = read("../../src/lib/academico/curtume-historic-batch-issues.ts");

test("diagnostics originate from exact RPC failures, not guesses or a second grade engine", () => {
  assert.match(migration, /v_state := SQLSTATE;/);
  assert.match(migration, /ON CONFLICT\(escola_id,matricula_id\) DO UPDATE/);
  assert.match(migration, /v_row\.historico_id/);
  assert.match(migration, /EXCLUDED\.codigo/);
  assert.match(migration, /historico_ano_id=h\.id/);
  assert.match(migration, /CURTUME_DIAGNOSTICO_BATCH_GUARD_CHANGED/);
  assert.doesNotMatch(migration, /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?public\.(?:notas|historico_disciplinas|matriculas|mensalidades)/i);
  assert.match(api, /recorded\?\.codigo \?\? "SEM_DIAGNOSTICO"/);
  assert.doesNotMatch(api, /historicas\.length === 0 \? "SEM_NOTAS_HISTORICAS"/);
});

test("read access stays tenant-specific and does not expose an RLS-definer shortcut", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.curtume_2025_fecho_diagnosticos FROM PUBLIC,anon,authenticated/);
  assert.match(migration, /p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'/);
  assert.match(migration, /public\.current_tenant_escola_id\(\) IS DISTINCT FROM p_escola_id/);
  assert.match(migration, /eu\.user_id=public\.safe_auth_uid\(\)/);
  assert.match(migration, /'admin_financeiro'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.curtume_2025_listar_fecho_pendencias\(uuid\)/);
  assert.match(migration, /TO authenticated/);
  assert.match(api, /await context\(\)/);
  assert.match(api, /SQL messages stay inside the protected diagnostic store/);
  assert.match(api, /\.map\(\(\{ matricula_id, codigo \}\) => \(\{ matricula_id, codigo \}\)\)/);
  assert.match(api, /\.eq\("escola_id", CURTUME\)/);
});

test("director can resolve source documents and operational marks inside canonical reconciliation", () => {
  assert.match(api, /OriginCorrectionSchema\.safeParse\(payload\)/);
  assert.match(api, /curtume_2025_regularizar_origem_documental/);
  assert.match(api, /curtume_2025_conferir_notas_documentais/);
  assert.match(api, /curtume_2025_transcrever_pauta_fisica/);
  assert.match(api, /CONFIRMO_ORIGEM_2025/);
  assert.match(desk, /regularizarOrigem\(\)/);
  assert.match(desk, /Conferi o ano, a turma de origem/);
  assert.match(desk, /Confirmar pauta de 2025\/2026/);
  assert.match(desk, /Guardar notas de 2025\/2026/);
  assert.match(page, /<CurtumeHistoricalExceptionDesk/);
  assert.match(page, /embedded/);
  assert.match(batch, /Resolver na Reconciliação/);
  assert.match(batch, /tipo: "historicos", ano: "2025", matricula_id: issue\.matricula_id/);
  assert.match(advice, /SEM_DIAGNOSTICO/);
});

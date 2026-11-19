import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../../supabase/migrations/20271119110000_curtume_mirror_signed_final_grades.sql");
const route = read("../../src/app/api/secretaria/operacoes-academicas/sincronizar-notas-finais/route.ts");
const ui = read("../../src/components/secretaria/CurtumeSincronizarNotasFinais.tsx");
const page = read("../../src/app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx");

test("only a genuine, legally locked Curtume 2025 final enters notas", () => {
  assert.match(sql, /curtume_2025_mfd_mirror_valid/);
  assert.match(sql, /h\.snapshot_status='fechado'/);
  assert.match(sql, /h\.resultado_final IN \('aprovado','reprovado','concluido'\)/);
  assert.match(sql, /historico_snapshot_locks/);
  assert.match(sql, /hd\.nota_final=p_valor/);
  assert.match(sql, /'fonte','historico_disciplinas'/);
  assert.match(sql, /'tipo_nota','HIST_FINAL'/);
  assert.match(sql, /hd\.notas_detalhe->>'ano_letivo' IN \('2025','2025\/2026'\)/);
  assert.match(sql, /'2023\[-_\/]\?/);
  assert.match(sql, /v_source\.nota_final/);
  assert.match(sql, /c\.numero BETWEEN 1 AND 12/);
  assert.doesNotMatch(sql, /session_replication_role|DISABLE TRIGGER/i);
});

test("historic final is a distinct zero-weight type, not a made-up trimestral component", () => {
  assert.match(sql, /'Final histórico \(pauta\)', 'HIST_FINAL',0,v_escala/);
  assert.match(sql, /a\.tipo='HIST_FINAL' AND a\.ano_letivo=2025/);
  assert.match(sql, /pl\.tipo='TRIMESTRE' AND pl\.numero=3/);
  assert.match(sql, /ON CONFLICT \(escola_id,matricula_id,avaliacao_id\) DO NOTHING/);
  assert.doesNotMatch(sql, /INSERT INTO public\.notas\s*\([^)]*MAC/);
  assert.doesNotMatch(sql, /UPDATE public\.notas/);
  assert.doesNotMatch(sql, /UPDATE public\.historico_disciplinas/);
  assert.doesNotMatch(sql, /UPDATE public\.historico_anos/);
});

test("mirror respects authenticated school membership and stays audit-only", () => {
  assert.match(sql, /current_tenant_escola_id\(\)=p_escola_id/);
  assert.match(sql, /eu\.escola_id=p_escola_id AND eu\.user_id=public\.safe_auth_uid\(\)/);
  assert.match(sql, /klasse\.curtume_2025_mirror/);
  assert.match(sql, /curtume_2025_pode_espelhar_nota\(NEW\.escola_id/);
  assert.match(sql, /curtume_2025_pode_criar_avaliacao_final\(NEW\.escola_id/);
  assert.match(sql, /public\.trigger_nota_outbox\(\)/);
  assert.match(sql, /CURTUME_2025_NOTAS_FINAIS_ESPELHADAS/);
  assert.match(sql, /NOT public\.curtume_2025_mfd_mirror_valid/);
  assert.match(sql, /curtume_2025_notas_conferidas_validas/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.curtume_2025_mfd_mirror_valid/);
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /\.eq\("escola_id", CURTUME\)\.eq\("user_id", user\.id\)/);
});

test("school can synchronize all eligible records in bounded repeatable batches without per-student confirmations", () => {
  assert.match(sql, /FOR UPDATE OF hd SKIP LOCKED/);
  assert.match(sql, /p_limite NOT BETWEEN 1 AND 100/);
  assert.match(sql, /curtume_2025_prever_espelhamento_notas/);
  assert.match(sql, /'documento_ano_divergente'/);
  assert.match(sql, /'historico_aberto'/);
  assert.match(route, /curtume_2025_espelhar_notas_finais/);
  assert.match(route, /limite: z\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/);
  assert.match(ui, /Sincronizar notas finais/);
  assert.match(ui, /MAX_LOTES = 80/);
  assert.match(ui, /chunk\.restantes === 0/);
  assert.match(ui, /chunk\.criadas === 0/);
  assert.match(page, /<CurtumeSincronizarNotasFinais/);
  assert.doesNotMatch(ui, /window\.confirm/);
});

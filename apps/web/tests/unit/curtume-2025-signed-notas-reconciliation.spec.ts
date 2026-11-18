import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const sql = read("../../../../supabase/migrations/20271117230000_curtume_2025_signed_operational_grades_reconciliation.sql");
const api = read("../../src/app/api/secretaria/operacoes-academicas/fecho-historico-lote/route.ts");
const desk = read("../../src/components/secretaria/CurtumeHistoricalExceptionDesk.tsx");

test("strict school/year/director authority for signing real 2025 sources", () => {
  assert.match(sql, /3744879f-2e19-4671-8995-78604302d8c5/);
  assert.match(sql, /m\.ano_letivo=2025/);
  assert.match(sql, /h\.ano_letivo=2025/);
  assert.match(sql, /public\.safe_auth_uid\(\)/);
  assert.match(sql, /public\.current_tenant_escola_id\(\)/);
  assert.match(sql, /'admin','admin_escola','diretor'/);
  assert.match(sql, /FOR UPDATE OF h,m/);
  assert.match(sql, /REVOKE ALL ON public\.curtume_2025_notas_conferidas/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.curtume_2025_notas_conferidas_validas/);
});

test("operational grades and historical documentary grades stay intact", () => {
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:FROM\s+)?public\.(?:notas|avaliacoes|historico_disciplinas|historico_anos)\b/i);
  // A documented, director-ratified 2025 source correction may update only
  // the historical enrollment's closure provenance, not existing grade rows.
  assert.match(sql, /UPDATE public\.matriculas m\s+SET status_fecho_origem='override_admin'/);
  assert.match(sql, /ratificar_resultado_historico_escola/);
  assert.match(sql, /m\.ano_letivo=2025/);
  assert.match(sql, /m\.status_fecho_origem='manual'/);
  assert.match(sql, /fontes_hash=EXCLUDED\.fontes_hash/);
  assert.match(sql, /to_jsonb\(n\)/);
  assert.match(sql, /to_jsonb\(hd\)/);
  assert.match(sql, /CURTUME_2025_NOTAS_CONFERIDAS_COM_PAUTA/);
  assert.match(sql, /notas_operacionais_preservadas/);
  assert.match(sql, /'pauta_escola_2025_2026'/);
});

test("all independent legal gates agree on the same validated fingerprint", () => {
  assert.match(sql, /curtume_fechar_pautas_2025_lote\(uuid,uuid,uuid,integer\)/);
  assert.match(sql, /historico_set_snapshot_state\(uuid,uuid\[\],uuid,text,text,uuid\)/);
  assert.match(sql, /resolve_raa_progression_for_matricula\(uuid,uuid\)/);
  assert.match(sql, /AND NOT public\.curtume_2025_notas_conferidas_validas/);
  assert.match(sql, /OR public\.curtume_2025_notas_conferidas_validas/);
  assert.match(sql, /'CURTUME_2025_RAA_GUARD_CHANGED'/);
  assert.match(sql, /snapshot_status IN \('aberto','fechado'\)/);
});

test("server signs exact 2025 enrollment and returns safe typed result", () => {
  assert.match(api, /const GradeReconciliationSchema = z\.object/);
  assert.match(api, /acao: z\.literal\("conferir_notas_2025"\)/);
  assert.match(api, /confirmacao: z\.literal\("CONFIRMO_PAUTA_2025"\)/);
  assert.match(api, /\.eq\("aluno_id", aluno_id\)\.eq\("matricula_id", matricula_id\)/);
  assert.match(api, /curtume_2025_conferir_notas_documentais/);
  assert.match(api, /curtume_2025_status_conferencia/);
  assert.match(desk, /Confirmar pauta de 2025\/2026/);
  assert.match(desk, /Conferi ambas as fontes/);
  assert.match(desk, /returnTo/);
  assert.match(desk, /setRevision\(\(value\) => value \+ 1\)/);
});

test("transcription for a missing 2025 physical pauta is one audited atomic write", () => {
  assert.match(sql, /curtume_2025_transcrever_pauta_fisica/);
  assert.match(sql, /h\.ano_letivo=2025/);
  assert.match(sql, /m\.ano_letivo=2025/);
  assert.match(sql, /m\.session_id=v_ano/);
  assert.match(sql, /t\.ano_letivo=2025/);
  assert.match(sql, /FOR UPDATE OF h,m/);
  assert.match(sql, /p_todas_disciplinas IS DISTINCT FROM true/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM public\.historico_disciplinas hd/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM public\.notas n/);
  assert.match(sql, /cc\.ano_letivo_id=v_ano/);
  assert.match(sql, /cm\.ativo/);
  assert.match(sql, /IF v_total IS DISTINCT FROM v_unique/);
  assert.match(sql, /'pauta_escola_oficial_transcrita'/);
  assert.match(sql, /CURTUME_2025_PAUTA_FISICA_TRANSCRITA/);
  assert.match(api, /const PhysicalPautaSchema = z\.object/);
  assert.match(api, /acao: z\.literal\("transcrever_pauta_2025"\)/);
  assert.match(api, /curtume_2025_transcrever_pauta_fisica/);
  assert.match(api, /confirmacao: z\.literal\("CONFIRMO_PAUTA_2025"\)/);
  assert.match(desk, /Guardar notas de 2025\/2026/);
  assert.match(desk, /Transcrevi todas as disciplinas e notas finais/);
});

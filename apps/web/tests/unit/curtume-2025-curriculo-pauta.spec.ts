import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../../../supabase/migrations/20271117210000_curtume_2025_matriz_pauta_6a.sql", import.meta.url),
  "utf8",
);

test("CURTUME 2025/2026 is the sole write scope, with source-backed subjects", () => {
  assert.match(sql, /v_escola constant uuid := '3744879f-2e19-4671-8995-78604302d8c5'/);
  assert.match(sql, /ano=2025/);
  assert.match(sql, /IF NOT EXISTS \(SELECT 1 FROM public.historico_anos/);
  assert.match(sql, /RETURN;/);
  assert.match(sql, /numero=6/);
  assert.match(sql, /AND ano_letivo=2025/);
  assert.match(sql, /h\.ano_letivo=2025/);
  assert.match(sql, /FOREACH v_nome IN ARRAY ARRAY\['História','Geografia','Educação Visual e Plástica'\]/);
  assert.match(sql, /v_count <> 43/);
  assert.match(sql, /hd\.disciplina_nome=v_nome/);
  assert.match(sql, /ON CONFLICT \(escola_id,curso_curriculo_id,classe_id,disciplina_id\) DO NOTHING/);
  assert.match(sql, /ON CONFLICT \(escola_id,turma_id,curso_matriz_id\) DO NOTHING/);
});

test("No notes, historical decisions, existing curriculum or next-year turma is mutated", () => {
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|TRUNCATE)\s+public\./i);
  assert.doesNotMatch(sql, /\bINSERT INTO public\.(?:notas|avaliacoes|historico_disciplinas|historico_anos|matriculas|turmas|anos_letivos|curso_curriculos)\b/i);
  assert.match(sql, /INSERT INTO public\.curso_matriz/);
  assert.match(sql, /INSERT INTO public\.turma_disciplinas/);
  assert.match(sql, /obrigatoria,ativo,classificacao,conta_para_media_med/);
  assert.match(sql, /false,true,'core',true/);
  assert.match(sql, /false,NULL,'inherit_school'/);
});

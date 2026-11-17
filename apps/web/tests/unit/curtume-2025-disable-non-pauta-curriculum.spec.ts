import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL(
    "../../../../supabase/migrations/20271117220000_curtume_2025_disable_non_pauta_curriculum.sql",
    import.meta.url,
  ),
  "utf8",
);

test("CURTUME 2025/2026 excess curricula alone are deactivated against documentary rows", () => {
  assert.match(sql, /3744879f-2e19-4671-8995-78604302d8c5/);
  assert.match(sql, /a\.ano=2025/);
  assert.match(sql, /h\.ano_letivo=2025/);
  assert.match(sql, /t\.ano_letivo=2025/);
  assert.match(sql, /hd\.disciplina_id=cm\.disciplina_id/);
  assert.match(sql, /t\.classe_id=cm\.classe_id/);
  assert.match(sql, /cc\.ano_letivo_id=v_ano/);
  assert.match(sql, /cc\.status='published'/);
  assert.match(sql, /UPDATE public\.curso_matriz cm\s+SET ativo=false/);
  assert.match(sql, /v_total_excess<>14/);
  assert.match(sql, /v_updated<>v_target_count/);
});

test("Legacy grades stay immutable and shared present-year curricula remain untouched", () => {
  assert.match(sql, /t\.ano_letivo IS DISTINCT FROM 2025/);
  assert.match(sql, /v_cross_year_count<>0/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /IF v_target_count=0 THEN\s+RETURN;/);
  assert.doesNotMatch(
    sql,
    /\b(?:DELETE|TRUNCATE|INSERT|UPDATE)\s+(?:INTO\s+|FROM\s+)?public\.(?:notas|avaliacoes|historico_disciplinas|historico_anos|turmas|turma_disciplinas|matriculas|disciplinas_catalogo)\b/i,
  );
  assert.doesNotMatch(sql, /SET\s+curso_matriz_id\s*=/i);
  assert.doesNotMatch(sql, /SET\s+disciplina_id\s*=/i);
});

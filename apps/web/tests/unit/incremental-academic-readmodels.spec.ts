import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = (file: string) =>
  readFileSync(resolve(process.cwd(), "../../supabase/migrations", file), "utf8");

const boletim = migration("20271130110000_boletim_change_aware_refresh.sql");
const topCursos = migration("20271130113000_incremental_top_course_averages.sql");

test("boletim keeps existing MV and skips only unchanged full refreshes", () => {
  assert.match(boletim, /CREATE TABLE IF NOT EXISTS internal\.boletim_refresh_state/);
  assert.match(boletim, /dirty_version = dirty_version \+ 1/);
  assert.match(boletim, /FOR EACH STATEMENT EXECUTE FUNCTION internal\.mark_boletim_dirty\(\)/);
  assert.match(boletim, /last_refreshed_at/);
  assert.match(boletim, /interval '24 hours'/);
  assert.match(boletim, /REFRESH MATERIALIZED VIEW CONCURRENTLY internal\.mv_boletim_por_matricula/);
  assert.match(boletim, /SELECT internal\.refresh_boletim_if_dirty\(\);/);
  assert.match(boletim, /refreshed_version = pg_catalog\.greatest\(refreshed_version, v_dirty\)/);
  assert.doesNotMatch(boletim, /DROP MATERIALIZED VIEW/);
  assert.doesNotMatch(boletim, /DROP VIEW public\.vw_boletim_por_matricula/);
});

test("boletim invalidations cover academic input tables without per-note row triggers", () => {
  for (const table of [
    "notas", "matriculas", "avaliacoes", "turma_disciplinas",
    "curso_matriz", "disciplinas_catalogo", "configuracoes_escola",
    "modelos_avaliacao"
  ]) {
    assert.ok(boletim.includes(`ON public.${table}`), `missing invalidation for ${table}`);
  }
  assert.match(boletim, /public\.refresh_mv_boletim_por_matricula\(\)/);
  assert.match(boletim, /internal\.refresh_boletim_if_dirty\(true\)/);
  assert.match(boletim, /pg_advisory_xact_lock/);
});

test("top courses use targeted course updates instead of a recurring global refresh", () => {
  assert.match(topCursos, /CREATE TABLE IF NOT EXISTS internal\.top_cursos_media_live/);
  assert.match(topCursos, /CREATE TABLE IF NOT EXISTS internal\.top_cursos_dirty/);
  assert.match(topCursos, /WHERE n\.escola_id=p_escola_id AND c\.escola_id=p_escola_id/);
  assert.match(topCursos, /AND c\.id=p_curso_id AND n\.valor IS NOT NULL/);
  assert.match(topCursos, /IS DISTINCT FROM \(EXCLUDED\.curso_nome,EXCLUDED\.media\)/);
  assert.match(topCursos, /FOR UPDATE SKIP LOCKED/);
  assert.match(topCursos, /SELECT internal\.process_top_cursos_dirty\(50\);/);
  assert.match(topCursos, /schedule := '\*\/10 \* \* \* \*'/);
  assert.match(topCursos, /SELECT internal\.enqueue_top_cursos_reconciliation\(\);/);
});

test("top courses preserve school-scoped security invoker API and manual refresh", () => {
  assert.match(topCursos, /ALTER TABLE internal\.top_cursos_media_live ENABLE ROW LEVEL SECURITY/);
  assert.match(topCursos, /CREATE POLICY top_cursos_read_own_school/);
  assert.match(topCursos, /eu\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(topCursos, /CREATE OR REPLACE VIEW public\.vw_top_cursos_media\s+WITH \(security_invoker = true\)/);
  assert.match(topCursos, /CREATE OR REPLACE FUNCTION public\.refresh_mv_top_cursos_media\(\)/);
  assert.match(topCursos, /GRANT SELECT ON TABLE internal\.top_cursos_media_live TO authenticated,service_role/);
  assert.match(topCursos, /REVOKE ALL ON FUNCTION/);
});

test("per-course invalidation catches grade changes and mapping changes", () => {
  for (const table of ["notas", "avaliacoes", "turma_disciplinas", "curso_matriz", "cursos"]) {
    for (const operation of ["insert", "update", "delete"]) {
      assert.match(topCursos, new RegExp(`trg_klasse_top_cursos_${operation} ON public\\.${table}`));
    }
  }
  assert.match(topCursos, /REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows/);
  assert.match(topCursos, /RETURN NULL/);
});

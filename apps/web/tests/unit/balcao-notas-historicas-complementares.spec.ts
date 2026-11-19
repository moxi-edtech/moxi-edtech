import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../../supabase/migrations/20271119100000_balcao_complementar_notas_historico_fechado.sql");
const api = read("../../src/app/api/secretaria/operacoes-academicas/notas-complementares/route.ts");
const ui = read("../../src/components/secretaria/BalcaoNotasComplementares.tsx");
const percurso = read("../../src/components/secretaria/BalcaoPercursoAcademico.tsx");

test("supplements are tenant scoped and append-only; official results never change", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.historico_notas_complementares/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.historico_notas_complementares FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /current_tenant_escola_id\(\) IS DISTINCT FROM p_escola_id/);
  assert.match(sql, /eu\.escola_id=p_escola_id AND eu\.user_id=v_actor/);
  assert.match(sql, /v_h\.snapshot_status<>'fechado'/);
  assert.match(sql, /historico_snapshot_locks l/);
  assert.match(sql, /v_m\.status<>'concluido'/);
  assert.match(sql, /v_m\.ano_ativo IS DISTINCT FROM false/);
  assert.match(sql, /'HISTORICO_NOTAS_COMPLEMENTARES_REGISTADAS'/);
  assert.doesNotMatch(sql, /UPDATE public\.historico_anos/);
  assert.doesNotMatch(sql, /UPDATE public\.historico_disciplinas/);
  assert.doesNotMatch(sql, /UPDATE public\.notas/);
  assert.doesNotMatch(sql, /DELETE FROM public\.notas/);
});

test("supplement does not silently override existing notes or alter the official final", () => {
  assert.match(sql, /HISTORIC_GRADE_ALREADY_EXISTS/);
  assert.match(sql, /ON CONFLICT \(escola_id,matricula_id,disciplina_id,trimestre,tipo_avaliacao\) DO NOTHING/);
  assert.match(sql, /AND c\.valor=v_value/);
  assert.match(sql, /hd\.nota_final/);
  assert.match(sql, /'resultado_oficial',v_h\.resultado_final/);
  assert.match(sql, /'resultado_oficial_preservado',v_h\.resultado_final/);
  assert.match(sql, /v_escala='quantitativa_primario'/);
  assert.match(sql, /'quantitativa_secundario'/);
  assert.match(sql, /v_value<0 OR v_value>v_max/);
});

test("one selected student receives only their existing year and subjects", () => {
  assert.match(api, /resolveEscolaIdForUser/);
  assert.match(api, /BALCAO_HISTORIC_OPERATOR_ROLES/);
  assert.match(api, /balcao_obter_notas_complementares/);
  assert.match(api, /balcao_complementar_notas_historicas/);
  assert.match(api, /matricula_id: z\.string\(\)\.uuid\(\)/);
  assert.match(api, /notas: z\.array\(Grade\)\.min\(1\)\.max\(100\)/);
  assert.match(sql, /hd\.historico_ano_id=v_h\.id/);
  assert.match(sql, /hd\.disciplina_id=v_disc/);
  assert.match(sql, /AND h\.matricula_id=v_m\.id/);
});

test("Balcão offers a single inline grade supplement editor even for an already homologated year", () => {
  assert.match(percurso, /<BalcaoNotasComplementares/);
  assert.match(percurso, /active\.situacao_resultado === "homologado"/);
  assert.match(percurso, /active\.status_persistido === "concluido"/);
  assert.match(ui, /Completar notas/);
  assert.match(ui, /Guardar/);
  assert.match(ui, /trimestre === term/);
  assert.match(ui, /snapshot\.pode_complementar/);
  assert.match(ui, /onSaved\(\)/);
  assert.match(ui, /readSnapshot\(matriculaId\)/);
  assert.doesNotMatch(ui, /window\.confirm/);
});

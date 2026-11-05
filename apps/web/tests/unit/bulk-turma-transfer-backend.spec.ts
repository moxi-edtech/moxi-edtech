import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../../supabase/migrations/20271031003000_bulk_turma_transfer_atomic.sql", import.meta.url),
  "utf8",
);

test("bulk transfer is one authenticated tenant-scoped Postgres transaction", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.transferir_turma_em_lote/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path = ''/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.current_tenant_escola_id\(\)/);
  assert.match(migration, /public\.user_has_role_in_school/);
  assert.match(migration, /ORDER BY t\.id\s+FOR UPDATE/);
  assert.match(migration, /ORDER BY m\.id\s+FOR UPDATE/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.transferir_turma_em_lote\(uuid,uuid,uuid,text\)/);
  assert.match(migration, /FROM PUBLIC, anon/);
  assert.match(migration, /TO authenticated/);
});

test("bulk transfer validates year, course, class, occupancy and expected update count", () => {
  assert.match(migration, /v_origem\.session_id IS DISTINCT FROM p_ano_letivo_id/);
  assert.match(migration, /v_destino\.session_id IS DISTINCT FROM p_ano_letivo_id/);
  assert.match(migration, /v_origem\.curso_id IS DISTINCT FROM v_destino\.curso_id/);
  assert.match(migration, /v_origem\.classe_id IS DISTINCT FROM v_destino\.classe_id/);
  assert.match(migration, /v_ocupacao_destino \+ v_quantidade > v_destino\.capacidade_maxima/);
  assert.match(migration, /IF v_atualizadas <> v_quantidade THEN/);
  const firstUpdate = migration.indexOf("UPDATE public.matriculas");
  const capacityCheck = migration.indexOf("IF v_ocupacao_destino + v_quantidade");
  const sourceCheck = migration.indexOf("IF v_quantidade = 0");
  assert.ok(sourceCheck >= 0 && sourceCheck < capacityCheck && capacityCheck < firstUpdate);
});

test("bulk transfer refuses academic records before any mutation", () => {
  const firstUpdate = migration.indexOf("UPDATE public.matriculas");
  for (const relation of [
    "public.notas", "public.exame_resultados", "public.frequencias",
    "public.frequencia_status_periodo", "public.presencas",
  ]) {
    const index = migration.indexOf(relation);
    assert.ok(index > 0 && index < firstUpdate, `${relation} must be guarded before UPDATE`);
  }
  assert.match(migration, /ERRCODE = 'P1050'/);
  assert.match(migration, /conciliação académica para preservar as pautas/);
});

test("bulk transfer updates original matriculas and records per-student audit in same transaction", () => {
  assert.match(migration, /UPDATE public\.matriculas m[\s\S]*SET turma_id = p_turma_destino_id/);
  assert.doesNotMatch(migration, /INSERT INTO public\.matriculas/);
  assert.match(migration, /INSERT INTO public\.audit_logs/);
  assert.match(migration, /FROM unnest\(v_matriculas\)/);
  assert.match(migration, /transferred/);
});

test("database trigger protects individual RPC and any direct change of matricula turma", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.guard_turma_transfer_academic_evidence_v1/);
  assert.match(migration, /BEFORE UPDATE OF turma_id ON public\.matriculas/);
  assert.match(migration, /CREATE TRIGGER trg_guard_turma_transfer_academic_evidence/);
  assert.match(migration, /OLD\.session_id IS DISTINCT FROM NEW\.session_id/);
  assert.match(migration, /y\.ativo IS TRUE/);
  assert.match(migration, /source\.classe_id IS NOT DISTINCT FROM target\.classe_id/);
  assert.match(migration, /source\.curso_id IS NOT DISTINCT FROM target\.curso_id/);
  assert.match(migration, /ERRCODE = 'P1050'/);
  assert.match(migration, /ERRCODE = 'P1051'/);
  assert.match(migration, /ERRCODE = 'P1052'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.guard_turma_transfer_academic_evidence_v1\(\)/);
});

test("academic evidence acquisition serializes with turma transfer and honors tenant", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.lock_matricula_for_academic_evidence_v1/);
  assert.match(migration, /WHERE m\.id = NEW\.matricula_id AND m\.escola_id = NEW\.escola_id\s+FOR SHARE/);
  for (const relation of ["notas", "exame_resultados", "frequencias", "frequencia_status_periodo"]) {
    assert.match(migration, new RegExp("BEFORE INSERT OR UPDATE ON public\\." + relation));
  }
  // presencas is a VIEW; its source, frequencias, owns the locking trigger.
  assert.doesNotMatch(migration, /BEFORE INSERT OR UPDATE ON public\.presencas/);
  assert.match(migration, /FOR SHARE/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.lock_matricula_for_academic_evidence_v1\(\)/);
  assert.doesNotMatch(migration, /CREATE TRIGGER a_00_lock_matricula_legacy_presenca/);
});

test("individual turma transfer uses the same restricted, atomic transfer contract", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.transferir_aluno_turma/);
  assert.match(migration, /v_target\.capacidade_maxima IS NULL OR v_target\.capacidade_maxima<=0/);
  assert.match(migration, /v_source\.session_id IS DISTINCT FROM v_target\.session_id/);
  assert.match(migration, /GET DIAGNOSTICS v_changed = ROW_COUNT/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.transferir_aluno_turma\(uuid,uuid,text\) FROM PUBLIC,anon/);
});

test("route invokes one RPC call after tenant, calendar and role authorization", () => {
  const route = source("app/api/secretaria/turmas/[id]/transferir/route.ts");
  assert.match(route, /resolveAcademicYearContext/);
  assert.match(route, /assertAcademicYearEntity/);
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /requireRoleInSchool/);
  assert.match(route, /\.rpc\("transferir_turma_em_lote"/);
  assert.match(route, /p_ano_letivo_id: academicContext\.anoLetivoId/);
  assert.match(route, /BULK_TRANSFER_ACADEMIC_RECORDS/);
  assert.doesNotMatch(route, /for \(const .*\.rpc\(/);
  assert.doesNotMatch(route, /temporariamente indisponível: use a transferência individual/);
});

test("UI fetches all compatible destinations and requires explicit confirmation", () => {
  const component = source("components/secretaria/TurmasListClient.tsx");
  assert.match(component, /setTransferCandidates\(all\)/);
  assert.match(component, /params\.set\("cursor", cursor\)/);
  assert.match(component, /ano_letivo_id: selectedTurmaForTransfer\.session_id!/);
  assert.match(component, /ano_letivo_id: selectedTurmaForTransfer\.session_id,/);
  assert.match(component, /transferConfirmed/);
  assert.match(component, /transferReason\.trim\(\)\.length < 10/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RAA_ACADEMIC_DECISION_ROLES } from "../../src/lib/academico/raa-academic-decision-roles";

const api=(path:string)=>readFileSync(resolve(process.cwd(),"src",path),"utf8");
const migration=()=>readFileSync(resolve(process.cwd(),"../../supabase/migrations/20271031002000_raa_reapreciacao_decision_permission_fix.sql"),"utf8");

test("academic appeal and disciplinary decisions are restricted to academic directors",()=>{
  assert.deepEqual([...RAA_ACADEMIC_DECISION_ROLES],["admin","admin_escola","diretor"]);
  const appeal=api("app/api/academico/raa/reapreciacao/decisao/route.ts");
  const discipline=api("app/api/academico/raa/indisciplina/route.ts");
  assert.match(appeal,/const decisionRoles = RAA_ACADEMIC_DECISION_ROLES/);
  assert.match(appeal,/requireRoleInSchool\(\{ supabase, escolaId, roles: \[\.\.\.decisionRoles\] \}\)/);
  assert.match(discipline,/const reviewRoles = RAA_ACADEMIC_DECISION_ROLES/);
});
test("the Balcao appeal uses the source enrolment year, not the currently active year",()=>{
  const panel=api("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const endpoint=api("app/api/academico/raa/reapreciacao/route.ts");
  assert.match(panel,/const anoOrigemId = academic\?\.source\?\.ano_letivo_id/);
  assert.match(panel,/academic\?\.source\?\.matricula_id !== matriculaId/);
  assert.match(panel,/ano_letivo_id: anoOrigemId/);
  assert.match(endpoint,/requestedAcademicYearId: body\.ano_letivo_id/);
  assert.match(endpoint,/\.eq\("session_id", academicContext\.anoLetivoId\)/);
  assert.match(endpoint,/prazo\.getTime\(\) <= Date\.now\(\)/);
});
test("client permissions are hints; decisions are enforced by API and RLS",()=>{
  const panel=api("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const appeal=api("app/api/academico/raa/reapreciacao/route.ts");
  const discipline=api("app/api/academico/raa/indisciplina/route.ts");
  assert.match(appeal,/can_decide: !decisionAccess\.error/);
  assert.match(discipline,/can_review: !reviewAccess\.error/);
  assert.match(panel,/loaded\(1\)\?\.can_decide === true/);
  assert.match(panel,/loaded\(3\)\?\.can_review === true/);
  assert.match(panel,/action === "reapreciacao" && !canDecideReapreciacao/);
  assert.match(panel,/action === "disciplina" && !canReviewDisciplina/);
});
test("no direct client UPDATE/DELETE or mutable student/tenant columns",()=>{
  const sql=migration();
  assert.match(sql,/DROP POLICY IF EXISTS reapreciacao_pedidos_tenant/);
  assert.match(sql,/REVOKE ALL ON TABLE public\.reapreciacao_pedidos FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/GRANT UPDATE \(estado, decisao_motivo, decidido_por, decidido_em, updated_at\)/);
  assert.match(sql,/FOR UPDATE TO authenticated/);
  assert.match(sql,/FOR INSERT TO authenticated/);
  assert.match(sql,/solicitado_por = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/decidido_por = \(SELECT auth\.uid\(\)\)/);
  assert.doesNotMatch(sql,/GRANT ALL ON .*reapreciacao_pedidos TO authenticated/);
});

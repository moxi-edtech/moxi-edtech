import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RAA_ACADEMIC_DECISION_ROLES, hasExactRaaAcademicDecisionRole } from "../../src/lib/academico/raa-academic-decision-roles";

const api=(path:string)=>readFileSync(resolve(process.cwd(),"src",path),"utf8");
const migration=()=>readFileSync(resolve(process.cwd(),"../../supabase/migrations/20271031002000_raa_reapreciacao_decision_permission_fix.sql"),"utf8");

test("academic appeal and disciplinary decisions include admin_financeiro explicitly",()=>{
  assert.deepEqual([...RAA_ACADEMIC_DECISION_ROLES],["admin","admin_escola","diretor","admin_financeiro"]);
  const appeal=api("app/api/academico/raa/reapreciacao/decisao/route.ts");
  const discipline=api("app/api/academico/raa/indisciplina/route.ts");
  assert.match(appeal,/hasExactRaaAcademicDecisionRole\(supabase, escolaId, auth\.user\.id\)/);
  assert.match(discipline,/hasExactRaaAcademicDecisionRole\(context\.supabase, context\.escolaId, context\.auth\.user\.id\)/);
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
  assert.match(appeal,/can_decide: canDecide/);
  assert.match(discipline,/can_review: canReview/);
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
  assert.match(sql,/public\.raa_has_exact_school_role/);
  assert.match(sql,/eu\.papel::text = ANY \(p_roles\)/);
  assert.match(sql,/DROP POLICY IF EXISTS raa_indisciplina_director_update_v2/);
  assert.match(sql,/FOR INSERT TO authenticated/);
  assert.match(sql,/solicitado_por = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/decidido_por = \(SELECT auth\.uid\(\)\)/);
  assert.doesNotMatch(sql,/GRANT ALL ON .*reapreciacao_pedidos TO authenticated/);
});

test("academic decisions allow exact roles without broadening via aliases", async () => {
  const mockFor = (papel: string | null) => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: papel === null ? null : { papel }, error: null }),
    }) }) }) }),
  });
  for (const papel of ["secretaria", "staff_admin", "professor", "secretaria_financeiro"]) {
    assert.equal(await hasExactRaaAcademicDecisionRole(mockFor(papel) as any, "school", "user"), false, papel);
  }
  for (const papel of RAA_ACADEMIC_DECISION_ROLES) {
    assert.equal(await hasExactRaaAcademicDecisionRole(mockFor(papel) as any, "school", "user"), true, papel);
  }
  assert.equal(await hasExactRaaAcademicDecisionRole(mockFor(null) as any, "school", "user"), false);
});

test("appeals accept only completed official PDF publication, using completion time", () => {
  const route = api("app/api/academico/raa/reapreciacao/route.ts");
  assert.match(route, /\.eq\("status", "SUCCESS"\)/);
  assert.match(route, /\.neq\("pdf_path", ""\)/);
  assert.match(route, /\.order\("updated_at", \{ ascending: false \}\)/);
  assert.match(route, /getOfficialRaaPublicationAt\(pautaPublicada\)/);
});

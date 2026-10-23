import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {isCommandCenterWholeSchoolRole,hasRequestedPoloScope} from "../../src/lib/command-center/school-wide-scope";

test("CC-003 school-wide access has strict institutional role whitelist", () => {
 for (const role of ["admin","admin_escola","staff_admin","diretor","secretaria","admin_secretaria","secretaria_financeiro","admin_financeiro","financeiro"]) assert.equal(isCommandCenterWholeSchoolRole(role),true);
 for (const role of ["professor","aluno","staff","administrador","super_admin",null,undefined,""]) assert.equal(isCommandCenterWholeSchoolRole(role),false);
});
test("CC-003 explicit polo never becomes school wildcard", () => {
 for (const query of ["polo_id=","polo_id=invalid","poloId=invalid","poloId=abc&foo=1"]) assert.equal(hasRequestedPoloScope("https://test.invalid/?"+query),true);
 assert.equal(hasRequestedPoloScope("https://test.invalid/"),false);
});
test("CC-003 database migration gives staff access but retains tenant/polo guards", () => {
 const roster=readFileSync(new URL("../../../../supabase/migrations/20271023100000_command_center_internal_roles.sql",import.meta.url),"utf8");
 const search=readFileSync(new URL("../../../../supabase/migrations/20271023101000_command_center_internal_global_search.sql",import.meta.url),"utf8");
 for (const sql of [roster, search]) {
  assert.match(sql,/admin_financeiro/);
  assert.match(sql,/admin_secretaria/);
  assert.match(sql,/financeiro/);
  assert.doesNotMatch(sql,/['"]professor['"]\s*,?\s*['"]aluno['"]/);
 }
 assert.match(roster,/has_access_to_escola_fast\(p_escola_id\)/);
 assert.match(roster,/p_polo_id IS NOT NULL/);
 assert.match(search,/has_access_to_escola_fast\(p_escola_id\)/);
 assert.match(search,/where not \(requested.kind = any\(v_allowed_types\)\)/);
});
test("CC-003 every Command Center reader checks role-bound scope", () => {
 for (const path of ["roster/route.ts","roster/export/route.ts","student-capabilities/route.ts","cursos/[cursoId]/route.ts","classes/[classeId]/route.ts","turmas/[turmaId]/route.ts","professores/[professorId]/route.ts","disciplinas/route.ts","disciplinas/[disciplinaId]/route.ts"]) {
  const src=readFileSync(new URL("../../src/app/api/escolas/[id]/command-center/"+path,import.meta.url),"utf8");
  assert.ok(src.includes("await requireCommandCenterSchoolWideAccess(supabase, user.id, escolaId, req)"),path);
  assert.ok(src.includes("if (schoolScopeError) return schoolScopeError;"),path);
 }
});
test("CC-003 PostgREST cannot bypass via operational or legacy roster RPC", () => {
 const sql=readFileSync(new URL("../../../../supabase/migrations/20271022141000_command_center_schoolwide_polo_barrier.sql",import.meta.url),"utf8");
 assert.match(sql,/auth.uid\(\) IS NULL/);
 assert.match(sql,/lower\(coalesce\(eu.papel,''\)\) IN/);
 assert.doesNotMatch(sql,/eu\.role/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public.command_center_roster_keyset\(/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public.command_center_roster_keyset_v2\(/);
 assert.match(sql,/IF p_polo_id IS NOT NULL THEN/);
});

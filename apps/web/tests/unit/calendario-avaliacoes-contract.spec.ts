import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd(), "../..");
const read = (name: string) => readFileSync(resolve(root, name), "utf8");
const schema = read("supabase/migrations/20261119110000_calendario_avaliacoes_auditado.sql");
const api = read("apps/web/src/app/api/escola/[id]/calendario-avaliacoes/route.ts");
const client = read("apps/web/src/components/academico/CalendarioAvaliacoesClient.tsx");
const nav = read("apps/web/src/lib/sidebarNav.ts");
const reader = read("apps/web/src/lib/academico/published-assessment-events.ts");
const student = read("apps/web/src/app/api/aluno/home/academic-events/route.ts");
const teacher = read("apps/web/src/app/api/professor/calendario/route.ts");

test("Calendário is operational, separate from MED official dates and notes", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.calendario_avaliacoes \(/);
  assert.doesNotMatch(api, /\.from\(["'](?:avaliacoes|notas|calendario_eventos)["']\)/);
  assert.match(schema, /FOREIGN KEY|REFERENCES public\.turma_disciplinas\(id\)/);
  assert.match(schema, /NEW\.data < v_periodo\.data_inicio/);
  assert.match(schema, /NEW\.data > v_periodo\.data_fim/);
  assert.match(schema, /ano_letivo_id = NEW\.ano_letivo_id/);
});

test("School rights include secretaria, admins, and director, not professor writes", () => {
  for (const role of ["secretaria", "admin", "admin_escola", "admin_financeiro", "admin_secretaria", "diretor"]) {
    assert.match(api, new RegExp('"' + role + '"'));
    assert.match(schema, new RegExp("'" + role + "'"));
  }
  assert.match(api, /requireRoleInSchool/);
  assert.match(schema, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(schema, /current_tenant_escola_id/g);
  assert.match(schema, /user_has_role_in_school/g);
  assert.match(schema, /REVOKE ALL ON public\.calendario_avaliacoes_auditoria/);
  assert.doesNotMatch(api, /service_role|createAdminClient/);
});

test("All changes are auditable and publish batches cannot partially succeed", () => {
  assert.match(schema, /CREATE TRIGGER trg_calendario_avaliacoes_audit/);
  assert.match(schema, /to_jsonb\(OLD\)/);
  assert.match(schema, /to_jsonb\(NEW\)/);
  assert.match(schema, /auth\.uid\(\)/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION public\.publicar_calendario_avaliacoes/);
  assert.match(schema, /FOR UPDATE;/);
  assert.match(schema, /v_updated <> v_total/);
  assert.match(api, /db\.rpc\("publicar_calendario_avaliacoes"/);
  assert.match(client, /Histórico de alterações/);
});

test("Only published events appear to authorized students and professors", () => {
  assert.match(reader, /\.eq\("estado", "publicado"\)/);
  assert.match(student, /readPublishedAssessmentEvents/);
  assert.match(student, /matricula\.turma_id/);
  assert.match(teacher, /readPublishedAssessmentEvents/);
  assert.match(teacher, /teacherClasses\.map/);
  assert.match(schema, /CREATE POLICY calendario_avaliacoes_alunos/);
  assert.match(schema, /CREATE POLICY calendario_avaliacoes_professor/);
});

test("Easy access in all administrative portals and academic operations", () => {
  for (const path of [
    "/operacoes/academico/calendario-avaliacoes",
    "/admin/operacoes-academicas/calendario-avaliacoes",
    "/secretaria/operacoes-academicas/calendario-avaliacoes",
  ]) assert.ok(nav.includes(path));
  assert.match(client, /Publicar/);
  assert.match(client, /Guardar rascunho/);
});

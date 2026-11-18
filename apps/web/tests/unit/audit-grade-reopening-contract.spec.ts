import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const repoRoot = existsSync(resolve(process.cwd(), "apps/web")) ? process.cwd() : resolve(process.cwd(), "../..");
import { resolveReopeningSubject } from "../../src/lib/academico/resolve-reopening-subject";

const link = (id: string, catalog: string, assessment: string, professor = "prof") => ({
  id, professor_id: professor, avaliacao_disciplina_id: assessment,
  curso_matriz: { disciplina_id: catalog, avaliacao_disciplina_id: assessment },
});

test("pedido do docente autoriza apenas disciplina avaliada inequívoca", () => {
  assert.deepEqual(resolveReopeningSubject([link("td1", "math", "assessment")], "math"), {
    ok: true, link: link("td1", "math", "assessment"), assessedSubjectId: "assessment",
  });
  assert.deepEqual(resolveReopeningSubject([
    link("td1", "math", "assessment"), link("td2", "geography", "assessment"),
  ], "math"), { ok: false, code: "SHARED_ASSESSMENT" });
  assert.deepEqual(resolveReopeningSubject([link("td1", "math", "assessment")], "history"),
    { ok: false, code: "UNKNOWN" });
  assert.deepEqual(resolveReopeningSubject([{
    id: "td1", professor_id: "prof", avaliacao_disciplina_id: null,
    curso_matriz: { disciplina_id: "math", avaliacao_disciplina_id: "assessment" },
  }], "math"), { ok: false, code: "UNRECONCILED" });
});

test("rotas usam utilizador autenticado, escola, turma, ano, professor e status condicionado", () => {
  const request = readFileSync(resolve(repoRoot, "apps/web/src/app/api/professor/notas/reabertura/route.ts"), "utf8");
  const decision = readFileSync(resolve(repoRoot, "apps/web/src/app/api/secretaria/notas/reabertura/route.ts"), "utf8");
  const migration = readFileSync(resolve(repoRoot, "supabase/migrations/20271118101000_grade_reopen_rls_guard.sql"), "utf8");
  assert.match(request, /supabase\.auth\.getUser\(\)/);
  assert.match(request, /resolveEscolaIdForUser/);
  assert.match(request, /\.eq\("ano_letivo_id", parsed\.data\.ano_letivo_id\)/);
  assert.match(request, /\.eq\("professor_id", professor\.id\)/);
  assert.match(decision, /requireRoleInSchool/);
  assert.match(decision, /\.eq\("status", parsed\.data\.status === "EXPIRADO"/);
  assert.match(migration, /DROP POLICY IF EXISTS tenant_all_access/);
  assert.match(migration, /CREATE POLICY excecoes_pauta_insert_professor/);
  assert.match(migration, /CREATE TRIGGER validar_transicao_excecao_pauta/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

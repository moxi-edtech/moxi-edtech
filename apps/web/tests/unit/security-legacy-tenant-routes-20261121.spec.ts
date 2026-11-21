import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const routePath = (suffix: string) => new URL(`../../src/app/api/${suffix}`, import.meta.url);
const route = (suffix: string) => readFileSync(routePath(suffix), "utf8");

test("a rota de diagnóstico pública não expõe consultas de alunos", () => {
  assert.equal(existsSync(routePath("teste-rpc/route.ts")), false);
});

test("exclusão legada de turma preserva matrícula e isolamento por escola", () => {
  const source = route("escolas/[id]/turmas/[turmaId]/delete/route.ts");
  assert.match(source, /createRouteClient/);
  assert.match(source, /supabase\.auth\.getUser\(/);
  assert.match(source, /resolveEscolaIdForUser\(supabase, user\.id, requestedEscolaId\)/);
  assert.match(source, /authorizeTurmasManage\(supabase, escolaId, user\.id\)/);
  assert.match(source, /\.from\('turmas'\)/);
  assert.match(source, /\.eq\('escola_id', escolaId\)/);
  assert.match(source, /\.from\('matriculas'\)/);
  assert.match(source, /if \(matriculas\?\.length\)/);
  assert.match(source, /status_validacao: 'arquivado'/);
  assert.match(source, /\.eq\('status_validacao', currentStatus\)/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient|\.delete\s*\(/);
});

test("cópia de calendário não aceita anos/eventos de outra escola", () => {
  const source = route("escola/[id]/admin/calendario/copiar-eventos/route.ts");
  assert.match(source, /supabase\.auth\.getUser\(/);
  assert.match(source, /resolveEscolaIdForUser/);
  assert.match(source, /requireRoleInSchool/);
  assert.match(source, /\.from\('anos_letivos'\)/);
  assert.match(source, /\.from\('calendario_eventos'\)/);
  assert.ok((source.match(/\.eq\('escola_id', userEscolaId\)/g) ?? []).length >= 2);
  assert.match(source, /escola_id: userEscolaId/);
  assert.match(source, /OFFICIAL_CALENDAR_COPY_NOT_ALLOWED/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");
const route = read("app/api/secretaria/admissoes/matriculas/route.ts");
const ui = read("components/secretaria/MatriculasListClient.tsx");

test("AUT-008 endpoint requires authenticated tenant + secretary role and explicit academic year", () => {
  assert.match(route, /supabase.auth.getUser\(\)/);
  assert.match(route, /resolveEscolaIdForUser\(supabase, user.id\)/);
  assert.match(route, /requireRoleInSchool\(/);
  assert.match(route, /requireCommandCenterSchoolWideAccess\(/);
  assert.match(route, /if \(schoolWide\) return schoolWide/);
  assert.match(route, /K12_SECRETARIA_OPERACIONAL_ROLE_GROUP/);
  assert.match(route, /requestedAcademicYearId: filter\.ano_letivo_id/);
  assert.match(route, /year\.escolaId !== escolaId/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("session_id", year\.anoLetivoId\)/);
  assert.match(route, /ACADEMIC_YEAR_MISMATCH/);
});

test("AUT-008 counts come from exact filtered server queries, never the current page", () => {
  assert.match(route, /count: "exact", head: forCount/);
  assert.match(route, /makeQuery\(true\)\.eq\("status", "ativo"\)\.eq\("ativo", true\)/);
  assert.match(route, /makeQuery\(true\)\.eq\("status", "pendente"\)/);
  assert.match(route, /summary: \{ ativos: active\.count, pendentes: pending\.count \}/);
  assert.match(route, /\.range\(\(filter\.page - 1\) \* filter\.pageSize, filter\.page \* filter\.pageSize - 1\)/);
  assert.doesNotMatch(ui, /items\.forEach\(\(item\) => \{\s*counts\[item.status\]/);
  assert.match(ui, /value=\{summary\.ativos\}/);
  assert.match(ui, /value=\{summary\.pendentes\}/);
  assert.match(ui, /Turmas nesta página/);
});

test("AUT-007/012 canonical statuses and fail-closed stale/ambiguous loading", () => {
  assert.match(route, /"rascunho", "pendente", "ativo", "concluido", "transferido", "anulado"/);
  assert.match(route, /status_in/);
  assert.match(route, /"Estado da matrícula inválido\."/);
  assert.match(ui, /statusKey === "ativo"/);
  assert.doesNotMatch(ui, /statusKey === "ativa"/);
  assert.match(ui, /selectedSessions\.length === 1/);
  assert.match(ui, /ano_letivo_id: selectedSessionId/);
  assert.match(ui, /abortRef\.current\?\.abort\(\)/);
  assert.match(ui, /setItems\(\[\]\);\s*setTotal\(0\);\s*setSummary/);
  assert.match(ui, /role="alert"/);
});

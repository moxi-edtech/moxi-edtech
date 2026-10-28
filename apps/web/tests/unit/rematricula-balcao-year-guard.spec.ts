import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveBalcaoRematriculaTargetYear } from "../../src/lib/rematricula/balcao-target-year";

test("sessão de destino é a escolhida pelo operador, nunca calculada pela última matrícula", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: 2026 }), 2026);
  assert.equal(resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: 2025 }), 2025);
  assert.equal(resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: 2027 }), 2027);
});

test("API resolve a janela da sessão seleccionada, sem inferir próxima matrícula", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/balcao/rematriculas/status/route.ts", import.meta.url), "utf8");
  assert.match(route, /selectedAcademicYear: Number\(academicContext\.anoLetivoLabel\.slice\(0, 4\)\)/);
  assert.match(route, /resolveRematriculaWindow\(supabase, escolaId, targetAnoLetivoAno\)/);
  assert.match(route, /resolveAnoLetivoScope\(supabase, escolaId, \{ anoLetivoId: academicContext\.anoLetivoId \}\)/);
  assert.doesNotMatch(route, /openTargetWindow/);
  assert.doesNotMatch(route, /latestStudentAcademicYear|ultimaMatriculaDoAluno/);
});

test("API nunca inventa sessão do ano destino nem omite o estado de bloqueio", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/balcao/rematriculas/status/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!targetScope\)/);
  assert.match(route, /status: "TARGET_YEAR_NOT_CONFIGURED"/);
  assert.match(route, /ano_letivo: null/);
  assert.doesNotMatch(route, /targetScope\?\.id\s*\?\?\s*academicContext\.anoLetivoId/);
});

test("API de turmas devolve a orientação RAA mesmo que a view não devolva linhas", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/turmas-simples/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(matriculaId && alunoId && sessionId && anoLetivo\)/);
  assert.doesNotMatch(route, /if \(matriculaId && alunoId && sessionId && anoLetivo && items\.length > 0\)/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Balcão selects a completed historical enrollment within the same school and student", () => {
  const src = readFileSync(
    new URL("../../src/components/secretaria/BalcaoAtendimento.tsx", import.meta.url),
    "utf8",
  );
  const start = src.indexOf('.lt("ano_letivo", targetAcademicYear)');
  assert.ok(start > -1, "requires a prior academic year");
  const query = src.slice(start, start + 390);
  assert.match(query, /\.in\("status", \[[^\]]*"concluido", "concluida"\]\)/);
  assert.match(src, /\.eq\("escola_id", escolaId\)/);
  assert.match(src, /\.eq\("aluno_id", alunoId\)/);
  assert.match(src, /\.order\("ano_letivo", \{ ascending: false \}\)/);
});

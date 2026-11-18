import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const repoRoot = existsSync(resolve(process.cwd(), "apps/web")) ? process.cwd() : resolve(process.cwd(), "../..");
import { findSuspectedSubjectEquivalences } from "../../src/lib/academico/discipline-equivalences";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("equivalência só agrupa a mesma classe e não confunde História e Geografia", () => {
  const groups = findSuspectedSubjectEquivalences([
    { id: uuid(1), nome: "Educação Manual e Plástica", class_ids: [uuid(11)] },
    { id: uuid(2), nome: "Ed. Manual e Plástica", class_ids: [uuid(11)] },
    { id: uuid(3), nome: "Educação Manual e Plástica", class_ids: [uuid(12)] },
    { id: uuid(4), nome: "História", class_ids: [uuid(11)] },
    { id: uuid(5), nome: "Geografia", class_ids: [uuid(11)] },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].candidates.map(x => x.id), [uuid(1), uuid(2)]);
  assert.equal(groups[0].classId, uuid(11));
});

test("decisão usa contexto autenticado, valida currículo no servidor e não altera notas", () => {
  const route = readFileSync(resolve(repoRoot, "apps/web/src/app/api/academico/equivalencias/route.ts"), "utf8");
  const migration = readFileSync(resolve(repoRoot, "supabase/migrations/20271118110000_curricular_equivalence_decisions.sql"), "utf8");
  const ui = readFileSync(resolve(repoRoot, "apps/web/src/components/escola/settings/CurricularEquivalenceDecisions.tsx"), "utf8");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /\["diretor", "admin_escola", "admin"\]/);
  assert.match(route, /findSuspectedSubjectEquivalences/);
  assert.match(route, /\.eq\("ano_letivo_id", ano_letivo_id\)/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FOR INSERT TO authenticated WITH CHECK/);
  assert.match(migration, /CREATE TRIGGER validar_decisao_equivalencia_curricular/);
  assert.doesNotMatch(migration, /UPDATE public\.notas|DELETE FROM public\.notas|UPDATE public\.curso_matriz/);
  assert.match(ui, /Registar decisão/);
  assert.match(ui, /currículo alterado|Currículo alterado/);
});

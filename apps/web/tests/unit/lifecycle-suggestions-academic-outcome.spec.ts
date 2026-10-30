import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route=readFileSync(new URL("../../src/app/api/secretaria/rematricula/sugestoes/route.ts",import.meta.url),"utf8");
test("suggestions block official academic failure, never administrative reprovado",()=>{
  assert.match(route,/v_student_lifecycle_status_v2/);
  assert.match(route,/resultado_oficial === 'reprovado'/);
  assert.match(route,/reprovacoesOficiais.has/);
  assert.doesNotMatch(route,/\.in\('status', \['ativo', 'ativa', 'active', 'reprovado'/);
  assert.match(route,/Não foi possível verificar os resultados académicos oficiais/);
});
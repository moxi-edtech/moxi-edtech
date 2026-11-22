import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORICAL_DISCIPLINES_PAGE_SIZE,
  parseHistoricalDisciplineQuery,
} from "../../src/lib/academico/historical-discipline-query";

test("Consulta do histórico aceita ano de origem e página explícitos", () => {
  assert.equal(HISTORICAL_DISCIPLINES_PAGE_SIZE, 25);
  assert.deepEqual(parseHistoricalDisciplineQuery(new URLSearchParams("ano=2025")), {
    ok: true, year: 2025, page: 1,
  });
  assert.deepEqual(parseHistoricalDisciplineQuery(new URLSearchParams("ano=2026&page=4")), {
    ok: true, year: 2026, page: 4,
  });
});

test("Consulta histórica rejeita anos ambíguos, filtros fora dos limites e páginas não inteiras", () => {
  for (const params of [
    "", "ano=2025%2F2026", "ano=2025.5", "ano=abc", "ano=209", "ano=1800",
    "ano=2025&page=0", "ano=2025&page=-1", "ano=2025&page=1.5",
    "ano=2025&page=0001", "ano=2025&page=1001",
  ]) {
    assert.equal(parseHistoricalDisciplineQuery(new URLSearchParams(params)).ok, false, params);
  }
});

test("Parâmetros de consulta nunca aceitam escola/ano por fallback implícito", () => {
  const result = parseHistoricalDisciplineQuery(new URLSearchParams("escola_id=outra-escola"));
  assert.equal(result.ok, false);
});

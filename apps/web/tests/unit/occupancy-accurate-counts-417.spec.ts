import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { groupOccupancyPage, type OcupacaoRow } from "../../src/lib/operacoes/occupancy-page";

const row = (n: number, classe = "6ª Classe", turno = "M"): OcupacaoRow => ({
  id: `row-${n}`,
  escola_id: "school-a",
  nome: `Turma ${n}`,
  classe,
  turno,
  sala: null,
  capacidade_maxima: 30,
  total_matriculas_ativas: n % 3 === 0 ? 0 : 15,
  ocupacao_percentual: n % 3 === 0 ? 0 : 50,
  status_ocupacao: "disponivel",
});
const api = readFileSync(
  new URL("../../src/app/api/secretaria/turmas/ocupacao/route.ts", import.meta.url),
  "utf8",
);
const ui = readFileSync(
  new URL("../../src/components/secretaria/OcupacaoClient.tsx", import.meta.url),
  "utf8",
);

test("page aggregation handles zero, one, 50 and 51 rows without fabricating school totals", () => {
  for (const size of [0, 1, 50, 51, 120]) {
    const rows = Array.from({ length: size }, (_, i) => row(i));
    const grouped = groupOccupancyPage(rows.slice(0, 25));
    assert.equal(grouped.flatMap(group => group.turmas).length, Math.min(size, 25));
    assert.equal(grouped.reduce((sum, group) => sum + group.capacidade_total, 0), Math.min(size, 25) * 30);
    assert.ok(grouped.every(group => Number.isFinite(group.ocupacao_media)));
  }
  assert.deepEqual(groupOccupancyPage([]), []);
  assert.equal(groupOccupancyPage([row(0)])[0]?.ocupacao_media, 0);
});

test("groups with equal class and different shift remain separate", () => {
  const groups = groupOccupancyPage([row(1, "5ª", "M"), row(2, "5ª", "T"), row(3, "6ª", "M")]);
  assert.equal(groups.length, 3);
  assert.equal(groups.reduce((n, group) => n + group.turmas.length, 0), 3);
  assert.equal(groups[0]?.ocupacao_media, 50);
});

test("API uses an exact count over school-scoped preaggregated view and paginates server-side", () => {
  assert.match(api, /\.from\("vw_ocupacao_turmas"\)/);
  assert.match(api, /count: "exact"/);
  assert.match(api, /\.eq\("escola_id", escolaId\)/);
  assert.match(api, /authorizeTurmasManage/);
  assert.match(api, /resolveEscolaIdForUser/);
  assert.match(api, /offset: \(queryInput\.page - 1\) \* queryInput\.pageSize/);
  assert.match(api, /maxLimit: 50/);
  assert.match(api, /total_turmas: count/);
  assert.match(api, /grupos_escopo: "pagina"/);
  assert.match(api, /\.from\("classes"\)/);
  assert.match(api, /\.eq\("escola_id", escolaId\)/);
  assert.doesNotMatch(api, /total_turmas: rows\.length|defaultLimit: 50/);
});

test("UI states page-local groups honestly and requests another page, not an unbounded result", () => {
  assert.match(ui, /OperationalTablePagination/);
  assert.match(ui, /total=\{safeData\.total_turmas\}/);
  assert.match(ui, /resultados_na_pagina/);
  assert.match(ui, /grupos e respetivas médias apresentam apenas a página atual/);
  assert.match(ui, /params\.set\("classe", classeFilter\)/);
  assert.match(ui, /escola_id: escolaId/);
  assert.match(ui, /AbortController/);
  assert.doesNotMatch(ui, /new Set\(data\.grupos/);
});

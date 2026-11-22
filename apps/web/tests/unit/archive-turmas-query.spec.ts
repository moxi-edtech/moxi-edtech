import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ARCHIVE_TURMAS_PAGE_SIZE, literalIlikePattern, parseArchiveTurmasQuery } from "../../src/lib/academico/archive-turmas-query";

const yearId = "a76b3468-0a31-484b-b9bf-4969b6fc39fe";
function query(extra = "") {
  return new URLSearchParams(`ano_letivo_id=${yearId}${extra}`);
}

test("Arquivo académico exige ID canónico e paginação limitada", () => {
  const valid = parseArchiveTurmasQuery(query("&page=2&q=Turma%20A"));
  assert.deepEqual(valid, { ok: true, value: { academicYearId: yearId, page: 2, q: "Turma A" } });
  assert.equal(ARCHIVE_TURMAS_PAGE_SIZE, 25);
  for (const params of [
    new URLSearchParams("page=1"),
    new URLSearchParams("ano_letivo_id=2025"),
    query("&page=0"),
    query("&page=-1"),
    query("&page=1.1"),
    query("&page=10001"),
    query("&q=" + "x".repeat(81)),
  ]) {
    assert.equal(parseArchiveTurmasQuery(params).ok, false);
  }
});

test("Arquivo recusa filtros de polo antes da consulta de dados", () => {
  assert.deepEqual(parseArchiveTurmasQuery(query("&polo_id=any")), {
    ok: false, status: 403, error: "Consulta por polo indisponível sem escopo canónico.",
  });
});

test("Pesquisa ILIKE trata caracteres especiais como texto literal", () => {
  const pattern = literalIlikePattern("Turma_%\\");
  assert.equal(pattern.startsWith("%") && pattern.endsWith("%"), true);
  assert.equal(pattern.includes("\\_"), true);
  assert.equal(pattern.includes("\\%"), true);
  assert.equal(pattern.includes("\\\\"), true);
});

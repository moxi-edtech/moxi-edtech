import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { filterAndPaginateOperationalRows } from "../../src/lib/operacoes/operational-table";
import { formatDate, formatDateTime } from "../../src/lib/formatters";

const readComponent = (name: string) =>
  readFileSync(new URL(`../../src/components/secretaria/${name}.tsx`, import.meta.url), "utf8");

test("class list preserves server-side cursor from #418 and masks stale tenant data", () => {
  const code = readComponent("ClassesListClient");
  assert.match(code, /buildEscolaUrl\(escolaId, "\/classes", params\)/);
  assert.match(code, /AbortController/);
  assert.match(code, /controller\.signal\.aborted/);
  assert.match(code, /loadedSchoolId !== escolaId/);
  assert.match(code, /setLoadedSchoolId\(escolaId\)/);
  assert.match(code, /json\.next_cursor/);
  assert.match(code, /fetchClasses\(nextCursor\)/);
  assert.match(code, /limit: "50"/);
  assert.match(code, /OperationalTableSkeleton/);
  assert.match(code, /OperationalTableEmptyState/);
  assert.match(code, /OperationalTableErrorState/);
  assert.match(code, /scope="col"/);
  assert.doesNotMatch(code, /text-moxinexa-navy|bg-teal-600|rounded-md/);
});

test("document and attendance queues keep audited API decisions and have accessible confirmation", () => {
  const documents = readComponent("DocumentosAprovacoesQueue");
  const attendance = readComponent("FaltasJustificacoesQueue");
  for (const code of [documents, attendance]) {
    assert.match(code, /OperationalTableFilterBar/);
    assert.match(code, /OperationalTablePagination/);
    assert.match(code, /OperationalTableEmptyState/);
    assert.match(code, /OperationalTableErrorState/);
    assert.match(code, /AbortController/);
    assert.match(code, /DialogTitle/);
    assert.match(code, /submitting/);
    assert.match(code, /aria-busy="true"/);
    assert.doesNotMatch(code, /window\.(?:confirm|prompt|alert)/);
    assert.doesNotMatch(code, /bg-klasse-blue|rounded-lg|bg-white/);
  }
  assert.match(documents, /pedidoId: selectedId, decision/);
  assert.match(documents, /decision === "reject" \? \{ motivo: reason\.trim\(\) \} : \{\}/);
  assert.match(documents, /decision === "reject" && !reason\.trim\(\)/);
  assert.match(documents, /maxLength=\{500\}/);
  assert.match(attendance, /id: selectedId, decision, motivo: reason\.trim\(\) \|\| undefined/);
  assert.match(attendance, /decision === "rejected" && reason\.trim\(\)\.length < 8/);
  assert.match(attendance, /maxLength=\{1000\}/);
});

test("search/pagination only describes loaded rows, including null names and out-of-range pages", () => {
  const rows = [
    { nome: "José", processo: "A-01" },
    { nome: null, processo: "A-02" },
    { nome: "Josefa", processo: "A-03" },
    ...Array.from({ length: 20 }, (_, index) => ({ nome: `Aluno ${index}`, processo: `B-${index}` })),
  ];
  const useRows = (search: string, page: number) => filterAndPaginateOperationalRows({
    rows,
    search,
    getSearchText: (row) => [row.nome ?? "", row.processo].join(" "),
    page,
    pageSize: 10,
  });
  assert.equal(useRows("jose", 1).filteredCount, 2);
  assert.equal(useRows("A-02", 1).filteredCount, 1);
  assert.equal(useRows("", 999).currentPage, 3);
  assert.equal(useRows("", 999).items.length, 3);
  assert.equal(useRows("missing", 10).currentPage, 1);
  assert.equal(useRows("missing", 10).items.length, 0);
});

test("school dates do not depend on the browser time zone", () => {
  assert.notEqual(formatDate("2026-11-21"), "—");
  assert.notEqual(formatDateTime("2026-11-21T10:30:00Z"), "—");
  assert.equal(formatDate("invalid"), "—");
});

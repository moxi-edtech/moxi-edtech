import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationalTablePagination, OperationalTableSkeleton } from "../../src/components/ui/OperationalTableStates";
import { filterAndPaginateOperationalRows } from "../../src/lib/operacoes/operational-table";

const sample = Array.from({ length: 23 }, (_, i) => ({
  id: String(i + 1),
  professor_nome: i === 0 ? "José Manuel" : i === 1 ? "Josefa" : `Professor ${i + 1}`,
}));
const paginate = (search: string, page: number) =>
  filterAndPaginateOperationalRows({
    rows: sample,
    search,
    getSearchText: (item) => item.professor_nome,
    page,
    pageSize: 10,
  });

test("table search is accent-insensitive and pagination stays in range", () => {
  assert.equal(paginate("Jose", 1).filteredCount, 2);
  assert.equal(paginate(" josé ", 1).filteredCount, 2);
  assert.equal(paginate("", 1).items.length, 10);
  assert.equal(paginate("", 3).items.length, 3);
  assert.equal(paginate("", 999).currentPage, 3);
  assert.equal(paginate("", -2).currentPage, 1);
  assert.equal(paginate("not found", 999).items.length, 0);
  assert.equal(paginate("not found", 999).currentPage, 1);
});

test("shared table loading skeleton has no interactive or fabricated rows", () => {
  const html = renderToStaticMarkup(React.createElement(OperationalTableSkeleton, {
    label: "A carregar relatório", columns: 8, rows: 3,
  }));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /min-w-\[840px\]/);
  assert.equal((html.match(/<tr\b/g) ?? []).length, 4);
  assert.doesNotMatch(html, /<(input|button|select)\b/);
});

test("pagination disables impossible directions and states the item range", () => {
  const first = renderToStaticMarkup(React.createElement(OperationalTablePagination, {
    page: 1, pageSize: 10, total: 23, onPageChange: () => {},
  }));
  const last = renderToStaticMarkup(React.createElement(OperationalTablePagination, {
    page: 3, pageSize: 10, total: 23, onPageChange: () => {},
  }));
  assert.match(first, /1–10 de 23/);
  assert.match(last, /21–23 de 23/);
  assert.match(first, /disabled[^>]*>Anterior/);
  assert.match(last, /disabled[^>]*>Seguinte/);
});

test("Secretary teacher-point report retains audit actions and uses shared table UI", () => {
  const source = readFileSync(new URL("../../src/app/secretaria/(portal-secretaria)/ponto-professores/page.tsx", import.meta.url), "utf8");
  assert.match(source, /filterAndPaginateOperationalRows/);
  assert.match(source, /OperationalTablePagination/);
  assert.match(source, /OperationalTableSkeleton/);
  assert.match(source, /pageItems\.map/);
  assert.match(source, /scope="col"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /changeClosure\("fechar"\)/);
  assert.match(source, /changeClosure\("reabrir"\)/);
  assert.match(source, /adjustAula\(aula\)/);
  assert.doesNotMatch(source, /window\.alert/);
});

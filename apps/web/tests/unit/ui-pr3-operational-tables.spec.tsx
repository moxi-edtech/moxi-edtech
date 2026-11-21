import * as React from "react";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Table } from "../../src/components/Table";
import {
  getOperationalPaginationState,
  OperationalTableSkeleton,
  OperationalTablePagination,
  OperationalCursorPagination,
  OperationalTableFilterBar,
  OperationalTableEmptyState,
  OperationalTableErrorState,
} from "../../src/components/ui/OperationalTableStates";
import { filterAndPaginateOperationalRows } from "../../src/lib/operacoes/operational-table";

const source = (relative: string) => readFileSync(new URL(`../../src/${relative}`, import.meta.url), "utf8");

test("pagination normalizes empty, overflow, invalid inputs and page ranges", () => {
  assert.deepEqual(getOperationalPaginationState(1, 10, 0), {
    pageCount: 1, current: 1, count: 0, start: 0, end: 0, hasPrevious: false, hasNext: false,
  });
  assert.deepEqual(getOperationalPaginationState(999, 10, 23), {
    pageCount: 3, current: 3, count: 23, start: 21, end: 23, hasPrevious: true, hasNext: false,
  });
  assert.equal(getOperationalPaginationState(-3, 10, 23).current, 1);
  const invalid = getOperationalPaginationState(Infinity, NaN, NaN);
  assert.equal(invalid.current, 1);
  assert.equal(invalid.count, 0);
  assert.equal(invalid.start, 0);
});

test("total-aware pagination exposes a screen-reader range and disables impossible actions", () => {
  const markup = renderToStaticMarkup(<OperationalTablePagination page={3} pageSize={10} total={23} onPageChange={() => {}} />);
  assert.match(markup, /21–23 de 23 resultados/);
  assert.match(markup, /aria-label="Paginação da tabela"/);
  assert.match(markup, /aria-current="page"/);
  assert.match(markup, /disabled[^>]*>Seguinte/);
  const busy = renderToStaticMarkup(<OperationalTablePagination page={2} pageSize={10} total={23} onPageChange={() => {}} disabled />);
  assert.equal((busy.match(/disabled=""/g) ?? []).length, 2);
});

test("cursor pagination never fabricates a school total", () => {
  const first = renderToStaticMarkup(<OperationalCursorPagination page={1} visibleCount={20} hasMore onPageChange={() => {}} />);
  assert.match(first, /Página 1 · 20 registos nesta página/);
  assert.match(first, /disabled[^>]*>Anterior/);
  assert.doesNotMatch(first, /de 20 resultados/);
  const last = renderToStaticMarkup(<OperationalCursorPagination page={5} visibleCount={1} hasMore={false} onPageChange={() => {}} />);
  assert.match(last, /Página 5 · 1 registo nesta página/);
  assert.match(last, /disabled[^>]*>Seguinte/);
});

test("filters announce purpose, allow clearing and keep focus visible", () => {
  const markup = renderToStaticMarkup(
    <OperationalTableFilterBar label="Pesquisar professores" placeholder="Procurar…" query="Maria" onQueryChange={() => {}} activeFilters={2} onClearFilters={() => {}}>
      <label>Período <select defaultValue="30"><option value="30">30 dias</option></select></label>
    </OperationalTableFilterBar>,
  );
  assert.match(markup, /role="search"/);
  assert.match(markup, /aria-label="Pesquisar professores"/);
  assert.match(markup, /aria-label="Limpar pesquisa"/);
  assert.match(markup, /Limpar filtros \(2\)/);
  assert.match(markup, /focus:ring-4/);
  assert.match(markup, /30 dias/);
});

test("loading, empty and error are distinct and do not create interactive skeleton rows", () => {
  const skeleton = renderToStaticMarkup(<OperationalTableSkeleton rows={NaN} columns={Infinity} />);
  assert.match(skeleton, /role="status"/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.match(skeleton, /motion-safe:animate-pulse/);
  assert.doesNotMatch(skeleton, /<(button|input|select)\b/);
  const empty = renderToStaticMarkup(<OperationalTableEmptyState title="Nenhum registo" description="Altere o filtro" />);
  assert.match(empty, /role="status"/);
  assert.match(empty, /Altere o filtro/);
  const error = renderToStaticMarkup(<OperationalTableErrorState onRetry={() => {}} description="Servidor indisponível" />);
  assert.match(error, /role="alert"/);
  assert.match(error, /Tentar novamente/);
  assert.doesNotMatch(error, /Tudo em dia/);
});

test("legacy Table wrapper remains compatible with children and forwards ARIA attributes", () => {
  const html = renderToStaticMarkup(<Table aria-label="Relatório"><tbody><tr><td>Teste</td></tr></tbody></Table>);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /rounded-xl border border-border/);
  assert.match(html, /<table aria-label="Relatório"/);
  assert.match(html, /<td>Teste<\/td>/);
});

test("filter + pagination are accent-insensitive and never modify the source data", () => {
  const rows = [{ nome: "José de Sousa" }, { nome: "Maria" }, { nome: "Josefa" }];
  const result = filterAndPaginateOperationalRows({ rows, search: "jose", getSearchText: (item) => item.nome, page: 5, pageSize: 1 });
  assert.equal(result.filteredCount, 2);
  assert.equal(result.currentPage, 2);
  assert.equal(result.items[0].nome, "Josefa");
  assert.equal(rows.length, 3);
});

test("active Secretary students reject stale page and filter requests and show page counts honestly", () => {
  const body = source("components/secretaria/AlunosSecretariaPage.tsx");
  assert.match(body, /const requestSequence = useRef\(0\)/);
  assert.match(body, /controller\.abort\(\)/);
  assert.match(body, /q !== debouncedQ/);
  assert.match(body, /requestId !== requestSequence\.current/);
  assert.match(body, /pageCursors\.current = \[null\]/);
  assert.match(body, /<OperationalCursorPagination/);
  assert.match(body, /registos"\} nesta página/);
  assert.match(body, /aria-pressed=\{isActive\}/);
  assert.match(body, /lg:group-focus-within:opacity-100/);
  assert.doesNotMatch(body, /setTabCounts|setTotal\(/);
  assert.match(body, /<OperationalTableErrorState/);
});

test("legacy student list retains cursor isolation without state-triggered refetch", () => {
  const body = source("components/secretaria/AlunosListClient.tsx");
  assert.match(body, /pageCursorsRef = useRef/);
  assert.match(body, /requestSequence\.current/);
  assert.match(body, /<OperationalCursorPagination/);
  assert.doesNotMatch(body, /\[pageCursors, setPageCursors\]/);
});

test("Secretary teachers debounce queries, ignore aborted results and preserve exports", () => {
  const body = source("components/secretaria/ProfessoresListClient.tsx");
  assert.match(body, /useDebounce\(q, 300\)/);
  assert.match(body, /q !== debouncedQ/);
  assert.match(body, /new AbortController\(\)/);
  assert.match(body, /requestId !== requestSequence\.current/);
  assert.match(body, /<OperationalTablePagination/);
  assert.match(body, /<OperationalTableFilterBar/);
  assert.match(body, /format=csv/);
  assert.match(body, /format=json/);
  assert.doesNotMatch(body, /useEffect\(\(\) => \{ load\(1\)/);
});

test("financial validation filters only displayed rows while preserving ledger actions and complete totals", () => {
  const body = source("components/financeiro/FilaValidacaoPagamentos.tsx");
  assert.match(body, /const stats = pagamentos\.reduce/);
  assert.match(body, /filterAndPaginateOperationalRows/);
  assert.match(body, /pageItems\.map\(\(p\)/);
  assert.match(body, /<OperationalTablePagination/);
  assert.match(body, /<OperationalTableEmptyState/);
  assert.match(body, /<OperationalTableErrorState/);
  assert.match(body, /<OperationalTableSkeleton/);
  assert.match(body, /requestId === requestSequence\.current/);
  assert.match(body, /setApprovalTarget\(null\)/);
  assert.match(body, /activeSchool\.current !== escolaId/);
  assert.match(body, /validarPagamentoAction\(pagamento\.pagamento_id, true\)/);
  assert.match(body, /validarPagamentoAction\(pagamento\.pagamento_id, false, motivo\.trim\(\)\)/);
});

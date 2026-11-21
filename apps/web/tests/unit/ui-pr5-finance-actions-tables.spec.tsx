import * as React from "react";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskList, type DashboardTaskItem } from "../../src/components/dashboard/TaskList";
import { formatDate, formatKwanza } from "../../src/lib/formatters";
import { parseTurmaSearch } from "../../src/lib/ui/turma-search";

const file = (path: string) => new URL(`../../src/${path}`, import.meta.url);
const source = (path: string) => readFileSync(file(path), "utf8");

const task: DashboardTaskItem = {
  id: "task-1",
  created_at: "2026-11-21T09:00:00.000Z",
  aluno: { nome: "Aluno Exemplo" },
  turma: { nome: "6.ª A" },
};

test("Tasks do not render unauthorized or inert actions without explicit server handlers", () => {
  const unactionable = renderToStaticMarkup(<TaskList items={[task]} />);
  assert.match(unactionable, /Aluno Exemplo/);
  assert.doesNotMatch(unactionable, /<button/);
  assert.doesNotMatch(unactionable, /Aprovar|Rejeitar/);

  const actionable = renderToStaticMarkup(
    <TaskList items={[task]} onApprove={async () => {}} onReject={async () => {}} />,
  );
  assert.match(actionable, /Aprovar matrícula de Aluno Exemplo/);
  assert.match(actionable, /Rejeitar matrícula de Aluno Exemplo/);
  assert.match(actionable, /aria-busy="false"/);
  assert.match(source("components/dashboard/TaskList.tsx"), /await handler\(item\)/);
  assert.match(source("components/dashboard/TaskList.tsx"), /role="alert"/);
});

test("student monthly payments use the same Angola money/date rules as the live portal", () => {
  const formatted = formatKwanza(5000);
  assert.match(formatted, /5[.\s\u00a0\u202f]?000/);
  assert.match(formatted, /Kz|AOA/i);
  assert.doesNotMatch(formatted, /R\$/);
  assert.equal(formatKwanza(null), "—");
  // Civil date must not move to the previous day for students in other time zones.
  assert.match(formatDate("2026-11-21"), /21/);
  const component = source("components/aluno/financeiro/MensalidadesTable.tsx");
  assert.match(component, /formatKwanza\(m\.valor\)/);
  assert.match(component, /formatDate\(m\.vencimento\)/);
  assert.match(component, /Por pagar \(Kz\)/);
  assert.doesNotMatch(component, /R\$|\.toFixed\(2\)/);
  assert.match(component, /OperationalTableErrorState/);
  const api = source("app/api/aluno/financeiro/route.ts");
  assert.match(api, /valor: Math\.max\(Number\(m\.valor_previsto/);
  assert.match(api, /\.eq\("escola_id", ctx\.escolaId\)/);
  assert.match(api, /resolveSelectedStudentId/);
});

test("turma server search is bounded, free of PostgREST operators and tenant scoped", () => {
  assert.deepEqual(parseTurmaSearch(" 7ª  Classe-M-A "), { value: "7ª Classe-M-A", valid: true });
  assert.deepEqual(parseTurmaSearch("\"%,id.eq.other),("), { value: "id eq other", valid: true });
  assert.deepEqual(parseTurmaSearch("%_(),"), { value: "", valid: false });
  assert.equal(parseTurmaSearch("t".repeat(81)).valid, false);
  assert.equal(parseTurmaSearch(null).valid, true);
  const api = source("app/api/escolas/[id]/turmas/route.ts");
  assert.match(api, /parseTurmaSearch\(url\.searchParams\.get\('busca'\)\)/);
  assert.match(api, /\.eq\('escola_id', userEscolaId\)/);
  assert.match(api, /\.eq\('session_id', context\.anoLetivoId\)/);
  assert.match(api, /turma_nome\.ilike/);
  assert.match(api, /fallbackQuery\.or\(`nome\.ilike/);
});

test("turma list scopes cursor and visible counts and prevents stale responses and cross-filter selection", () => {
  const component = source("components/secretaria/TurmasListClient.tsx");
  assert.match(component, /filters\.status === "ativos" \? "ativo"/);
  assert.match(component, /listRequestRef\.current\?\.abort\(\)/);
  assert.match(component, /signal: controller\.signal/);
  assert.match(component, /\.every\(\(id\) => prev\.has\(id\)\)/);
  assert.match(component, /turmas apresentadas/);
  assert.match(component, /turmas carregadas/);
  assert.match(component, /Filtros como vagas/);
  assert.match(component, /OperationalTableErrorState/);
  assert.match(component, /pedagogicoStats, busca\]\);/);
  assert.doesNotMatch(component, /selectedIds\.size === filteredIds\.length/);
});

test("classes and imports use real cursors, recover from errors and do not invent global counts", () => {
  const classes = source("components/secretaria/ClassesListClient.tsx");
  const imports = source("components/secretaria/ImportacoesListClient.tsx");
  for (const component of [classes, imports]) {
    assert.match(component, /AbortController/);
    assert.match(component, /next_cursor/);
    assert.match(component, /Carregar mais/);
    assert.match(component, /OperationalTableErrorState/);
    assert.match(component, /não representa|Não é uma contagem global/);
  }
  assert.match(classes, /limit: "50"/);
  assert.match(imports, /limit: "30"/);
  assert.match(imports, /Contagens inconsistentes/);
});

test("payment total is visibly only a 50-row subtotal and outdated fetch cannot overwrite newer tenant/filter", () => {
  const api = source("app/api/financeiro/pagamentos/route.ts");
  const component = source("components/financeiro/PagamentosListClient.tsx");
  assert.match(api, /\.limit\(50\)/);
  assert.match(component, /Somatório parcial dos resultados devolvidos/);
  assert.match(component, /máximo de 50/);
  assert.match(component, /requestSequence\.current/);
  assert.match(component, /currentRequest !== requestSequence\.current/);
  assert.match(component, /requestSequence\.current \+= 1/);
});

test("enrollment pagination uses real exact server totals and no inert More button", () => {
  const component = source("components/secretaria/MatriculasListClient.tsx");
  const api = source("app/api/secretaria/admissoes/matriculas/route.ts");
  assert.match(api, /count: "exact", head: forCount/);
  assert.match(component, /<OperationalTablePagination/);
  assert.match(component, /total=\{total\}/);
  assert.match(component, /pageSize=\{pageSize\}/);
  assert.doesNotMatch(component, /<MoreVertical|title="Mais"/);
});

test("turma bulk notification cannot pretend to send without a backend", () => {
  const component = source("components/secretaria/TurmasListClient.tsx");
  assert.doesNotMatch(component, /handleBulkNotify|Notificar Encarregados|Notificações em fila/);
  assert.match(component, /handleBulkPrint/);
  assert.match(component, /handleBulkClose/);
});

test("unused dashboard wrappers removed and public barrel no longer exports them", () => {
  const removed = ["ActionCard", "SecondaryAction", "TaskListSkeleton"];
  const index = source("components/dashboard/index.ts");
  for (const name of removed) {
    assert.equal(existsSync(file(`components/dashboard/${name}.tsx`)), false, name);
    assert.doesNotMatch(index, new RegExp(name));
  }
  assert.match(index, /\.\/TaskList/);
});

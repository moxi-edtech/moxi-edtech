import * as React from "react";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusPill } from "../../src/components/ui/StatusPill";
import { getStatusTone } from "../../src/lib/ui/status-presentation";

const file = (relativePath: string) => new URL(`../../src/${relativePath}`, import.meta.url);
const source = (relativePath: string) => readFileSync(file(relativePath), "utf8");

test("duplicate dashboard/secretary panels are removed; live widgets keep their own behavioral contracts", () => {
  const gone = [
    "components/secretaria/tasks/TaskList.tsx",
    "components/secretaria/tasks/TaskItem.tsx",
    "components/secretaria/dashboard/NoticePanel.tsx",
    "components/secretaria/dashboard/NoticeItem.tsx",
    "components/ui/CompactEmptyState.tsx",
  ];
  for (const path of gone) assert.equal(existsSync(file(path)), false, path);
  const activeNotice = source("components/dashboard/NoticePanel.tsx");
  const activeTask = source("components/dashboard/TaskList.tsx");
  assert.match(activeNotice, /EstadoVazio/);
  assert.match(activeTask, /EstadoVazio/);
  assert.match(activeNotice, /itemsFiltrados/);
  assert.match(activeNotice, /onSnooze/);
  assert.match(activeNotice, /aria-pressed=\{filtroAtivo === cat\.id\}/);
  assert.match(activeNotice, /const filtroAtivo = categorias\.some\(cat => cat\.id === filtro\) \? filtro : 'all'/);
  assert.match(activeNotice, /items\.some\(item => item\.type === cat\.id\)/);
  assert.match(activeNotice, /bg-card/);
  assert.match(activeTask, /<TaskItem/);
  assert.match(source("app/secretaria/(portal-secretaria)/Dashboard.tsx"), /@\/components\/dashboard/);
});

test("student payment and school enrollment states reuse the canonical StatusPill", () => {
  assert.equal(getStatusTone("pago", "financeiro"), "success");
  assert.equal(getStatusTone("pendente", "financeiro"), "pending");
  assert.equal(getStatusTone("atrasado", "financeiro"), "danger");
  assert.equal(getStatusTone("aprovada", "matricula"), "success");
  assert.equal(getStatusTone("submetida", "matricula"), "pending");
  assert.equal(getStatusTone("suspenso", "matricula"), "pending");
  assert.equal(getStatusTone("nao_atrasado", "financeiro"), "neutral");
  const html = renderToStaticMarkup(<StatusPill status="atrasado" variant="financeiro" />);
  assert.match(html, /text-rose-700/);
  assert.match(html, /atrasado/);
  assert.match(source("components/aluno/financeiro/MensalidadesTable.tsx"), /<StatusPill status=\{m\.status\} variant="financeiro"/);
  for (const path of ["components/secretaria/AlunosSecretariaPage.tsx", "components/secretaria/AlunosListClient.tsx"]) {
    const component = source(path);
    assert.match(component, /StatusPill as StatusBadge/);
    assert.doesNotMatch(component, /function StatusBadge\(/);
  }
});

test("orphan duplicates have been physically removed; secured sign-out is the only workflow", () => {
  const removed = [
    "components/Card.tsx",
    "components/auth/LogoutButton.tsx",
    "components/aluno/financeiro/StatusPill.tsx",
    "components/secretaria/tasks/EmptyTasks.tsx",
    "components/secretaria/dashboard/EmptyNotices.tsx",
  ];
  for (const candidate of removed) assert.equal(existsSync(file(candidate)), false, candidate);
  const signOut = source("components/auth/SignOutButton.tsx");
  assert.match(signOut, /clearIdentityCardCache\(\)/);
  assert.match(signOut, /clearOfflineData\(\)/);
  assert.match(signOut, /\/api\/auth\/logout/);
  assert.match(signOut, /klasse:rematricula:draft:/);
  assert.match(source("components/Card.stories.tsx"), /from "\.\/ui\/Card"/);
});

test("active school pages use semantic theme and brand tokens instead of old brands/hex literals", () => {
  const teachers = source("components/secretaria/ProfessoresListClient.tsx");
  assert.doesNotMatch(teachers, /moxinexa-(navy|teal)|bg-muted0|rounded-lg/);
  assert.match(teachers, /bg-klasse-gold/);
  assert.match(teachers, /PORTAL_PAGE_INSET/);
  assert.match(teachers, /OperationalTablePagination/);
  const students = source("components/secretaria/AlunosSecretariaPage.tsx");
  assert.doesNotMatch(students, /\[#[a-fA-F0-9]{6}\]/);
  assert.doesNotMatch(students, /rounded-lg/);
  assert.match(students, /text-klasse-green/);
  assert.match(students, /OperationalCursorPagination/);
});

test("canonical notice panel still has category filters, snooze and academic actions", () => {
  const notice = source("components/dashboard/NoticePanel.tsx");
  assert.match(notice, /setFiltro\(cat\.id\)/);
  assert.match(notice, /handleSnooze\(opt\.days\)/);
  assert.match(notice, /onAction\(item\)/);
  assert.match(notice, /item\.action_href/);
  assert.match(source("components/secretaria/ProfessoresListClient.tsx"), /professores\/export\?format=csv/);
  assert.match(source("components/secretaria/AlunosSecretariaPage.tsx"), /setArchiveTarget/);
});
